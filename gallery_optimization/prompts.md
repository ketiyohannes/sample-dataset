You are a senior Python engineer responsible for optimizing the get_paginated_images function in the provided gallery.py module. The current implementation returns correct paginated results but performs work proportional to the full dataset size on every request, introducing unacceptable latency variability, memory overhead, and poor scalability as usage grows. This function exists within an image-management subsystem expected to support frequent pagination queries, album-specific lookups, and continuous dataset mutation while maintaining deterministic ordering and complete behavioral consistency. Your task is to redesign the internal execution model so that pagination retrieval is independent of total collection size once any necessary internal preparation has occurred. The refactored implementation must preserve identical observable behavior, including result ordering, metadata structure, and filtering semantics, while maintaining compatibility with the existing function signature, class interface, and benchmarking environment. 

The system receives records from an in-memory collection and supports pagination parameters, optional album filtering, and sorting direction controls. The redesigned implementation must ensure pagination retrieval executes in O(k) time complexity, where k represents page size, and must avoid processing records outside the requested result window. Any preparation required to achieve this performance must occur outside the pagination path and remain stable under ongoing insertions, without requiring complete reconstruction of internal structures or altering observable behavior. Album-filtered queries must not incur processing proportional to unrelated images, ordering must remain stable and deterministic even with duplicate timestamps, and pagination must avoid materializing unnecessary portions of the dataset in memory when only partial results are required. Edge conditions must be handled correctly, including invalid page parameters, empty datasets, unmatched filters, and out-of-range requests, and the implementation must include assertions or equivalent validation confirming behavioral equivalence with the original function. Success is defined by meeting strict retrieval complexity guarantees, supporting dataset mutation without performance regression, improving memory efficiency, and maintaining production-grade readability and maintainability while remaining fully transparent to external consumers.

from datetime import datetime
from typing import List, Optional, Dict, Any


class Image:
    def __init__(self, id: str, filename: str, album_id: Optional[str], 
                 uploaded_at: datetime, size_bytes: int, width: int, height: int):
        self.id = id
        self.filename = filename
        self.album_id = album_id
        self.uploaded_at = uploaded_at
        self.size_bytes = size_bytes
        self.width = width
        self.height = height
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'filename': self.filename,
            'album_id': self.album_id,
            'uploaded_at': self.uploaded_at.isoformat(),
            'size_bytes': self.size_bytes,
            'width': self.width,
            'height': self.height
        }


class ImageGallery:
    def __init__(self):
        self.images: List[Image] = []
    
    def add_image(self, image: Image) -> None:
        self.images.append(image)
    
    def add_images(self, images: List[Image]) -> None:
        self.images.extend(images)
    
    def get_paginated_images(
        self,
        page: int = 1,
        page_size: int = 20,
        album_id: Optional[str] = None,
        sort_ascending: bool = False
    ) -> Dict[str, Any]:
        if page < 1:
            raise ValueError("Page number must be at least 1")
        
        all_images = list(self.images)
        
        if album_id is not None:
            filtered_images = []
            for img in all_images:
                if img.album_id == album_id:
                    filtered_images.append(img)
        else:
            filtered_images = all_images
        
        sorted_images = sorted(
            filtered_images,
            key=lambda img: img.uploaded_at,
            reverse=not sort_ascending
        )
        
        total_count = len(sorted_images)
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
        
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        page_images = sorted_images[start_index:end_index]
        
        result_images = [img.to_dict() for img in page_images]
        
        return {
            'images': result_images,
            'total_count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages
        }
    
    def get_album_image_count(self, album_id: str) -> int:
        count = 0
        for img in self.images:
            if img.album_id == album_id:
                count += 1
        return count
    
    def get_all_album_ids(self) -> List[str]:
        album_ids = set()
        for img in self.images:
            if img.album_id is not None:
                album_ids.add(img.album_id)
        return list(album_ids)


def generate_test_images(count: int, num_albums: int = 10) -> List[Image]:
    import random
    from datetime import timedelta
    
    images = []
    base_date = datetime(2020, 1, 1)
    
    for i in range(count):
        img = Image(
            id=f"img_{i:06d}",
            filename=f"photo_{i:06d}.jpg",
            album_id=f"album_{i % num_albums:03d}" if i % 5 != 0 else None,
            uploaded_at=base_date + timedelta(seconds=random.randint(0, 86400 * 365 * 4)),
            size_bytes=random.randint(100000, 5000000),
            width=random.choice([1920, 3840, 4032, 1080]),
            height=random.choice([1080, 2160, 3024, 1920])
        )
        images.append(img)
    
    return images


if __name__ == "__main__":
    import time
    
    print("Generating 10,000 test images...")
    test_images = generate_test_images(10000)
    
    gallery = ImageGallery()
    gallery.add_images(test_images)
    
    print("\nBenchmarking pagination performance:\n")
    
    for page_num in [1, 10, 50, 100, 500]:
        start = time.perf_counter()
        result = gallery.get_paginated_images(page=page_num, page_size=20)
        elapsed = time.perf_counter() - start
        print(f"Page {page_num:3d}: {elapsed*1000:.2f}ms - Retrieved {len(result['images'])} images")
    
    print("\nBenchmarking with album filter:\n")
    
    for page_num in [1, 10, 50]:
        start = time.perf_counter()
        result = gallery.get_paginated_images(page=page_num, page_size=20, album_id="album_003")
        elapsed = time.perf_counter() - start
        print(f"Album filter, Page {page_num:2d}: {elapsed*1000:.2f}ms - Retrieved {len(result['images'])} images")
    
    print("\n" + "="*60)
    print("ISSUE: Notice that fetching page 500 takes the same time as page 1")
    print("       because we sort ALL images before slicing to the page.")
    print("       This is O(n log n) for EVERY request regardless of page.")
    print("="*60)





Requirements:

The current implementation loads all images, filters by album, sorts by date, then slices for the requested page. Refactor this to avoid processing records that will not appear in the final result. The key insight is that for page N with size K, you only need the records ranked between (N-1)*K and N*K.

Implement a solution that achieves O(k) time complexity for retrieving a page of results after initial data structure setup, where k is the page size. This may require preprocessing the data into a more efficient structure during initialization rather than on every request.

Maintain exact behavioral compatibility with the original function. The returned list of images must be identical in content and order for any given set of parameters. Write assertions or include a test that verifies the optimized version produces the same output as the original.

Handle edge cases including requests for pages beyond the available data which should return empty lists, page numbers less than 1 which should raise ValueError, empty album filters which should return all images, and collections with duplicate timestamps which should maintain stable ordering.

The album filtering must also be optimized. If a user requests images from a specific album, the solution should not need to scan through images from other albums. Consider maintaining per-album indexes or using appropriate data structures for fast membership testing.

Optimize memory usage by avoiding the creation of full intermediate lists or copies of the dataset during pagination. The implementation should only materialize the specific records required for the requested page, ensuring minimal memory overhead per request. Document your memory optimization strategy in code comments.

The solution must be implemented in Python 3.8+ using only the standard library without any external dependencies like NumPy or Pandas. All code must strictly adhere to PEP 8 style guidelines and utilize Python type hints throughout. Crucially, the public API (class names and method signatures) must remain unmodified to ensure seamless integration with the existing test suite.

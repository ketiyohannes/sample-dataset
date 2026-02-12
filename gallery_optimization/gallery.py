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
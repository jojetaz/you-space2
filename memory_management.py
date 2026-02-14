#!/usr/bin/env python3

class MemoryBlock:
    def __init__(self, start_address, size, is_free=True):
        self.start_address = start_address
        self.size = size
        self.is_free = is_free
        self.process_id = None

    def __str__(self):
        status = "Free" if self.is_free else f"Allocated to Process {self.process_id}"
        return f"Memory Block [0x{self.start_address:08X} - 0x{self.start_address + self.size - 1:08X}] {self.size} bytes: {status}"

class MemoryManager:
    def __init__(self, total_memory=1024*1024):  # Default 1MB
        self.total_memory = total_memory
        self.blocks = [MemoryBlock(0, total_memory)]
        print(f"Memory Manager initialized with {total_memory} bytes of memory")

    def allocate(self, process_id, size, algorithm="first_fit"):
        if algorithm == "first_fit":
            return self._first_fit(process_id, size)
        elif algorithm == "best_fit":
            return self._best_fit(process_id, size)
        elif algorithm == "worst_fit":
            return self._worst_fit(process_id, size)
        else:
            print(f"Unknown allocation algorithm: {algorithm}")
            return None

    def _first_fit(self, process_id, size):
        for i, block in enumerate(self.blocks):
            if block.is_free and block.size >= size:
                return self._allocate_from_block(i, process_id, size)
        print(f"First Fit: Could not allocate {size} bytes for Process {process_id}")
        return None

    def _best_fit(self, process_id, size):
        best_block_index = -1
        best_block_size = float('inf')

        for i, block in enumerate(self.blocks):
            if block.is_free and block.size >= size:
                if block.size < best_block_size:
                    best_block_index = i
                    best_block_size = block.size

        if best_block_index != -1:
            return self._allocate_from_block(best_block_index, process_id, size)
        else:
            print(f"Best Fit: Could not allocate {size} bytes for Process {process_id}")
            return None

    def _worst_fit(self, process_id, size):
        worst_block_index = -1
        worst_block_size = 0

        for i, block in enumerate(self.blocks):
            if block.is_free and block.size >= size:
                if block.size > worst_block_size:
                    worst_block_index = i
                    worst_block_size = block.size

        if worst_block_index != -1:
            return self._allocate_from_block(worst_block_index, process_id, size)
        else:
            print(f"Worst Fit: Could not allocate {size} bytes for Process {process_id}")
            return None

    def _allocate_from_block(self, block_index, process_id, size):
        block = self.blocks[block_index]
        allocated_address = block.start_address

        if block.size > size:  # Split the block
            remaining_block = MemoryBlock(
                block.start_address + size,
                block.size - size,
                True
            )
            self.blocks.insert(block_index + 1, remaining_block)
            block.size = size

        block.is_free = False
        block.process_id = process_id
        print(f"Allocated {size} bytes at address 0x{allocated_address:08X} to Process {process_id}")
        return allocated_address

    def deallocate(self, process_id):
        deallocated = False
        i = 0
        while i < len(self.blocks):
            if not self.blocks[i].is_free and self.blocks[i].process_id == process_id:
                self.blocks[i].is_free = True
                self.blocks[i].process_id = None
                deallocated = True
                print(f"Deallocated memory for Process {process_id} at address 0x{self.blocks[i].start_address:08X}")
                
                # Merge with adjacent free blocks
                self._merge_adjacent_free_blocks()
            i += 1
                
        if not deallocated:
            print(f"No memory allocated to Process {process_id}")
        return deallocated

    def _merge_adjacent_free_blocks(self):
        i = 0
        while i < len(self.blocks) - 1:
            if self.blocks[i].is_free and self.blocks[i+1].is_free:
                # Merge blocks i and i+1
                self.blocks[i].size += self.blocks[i+1].size
                self.blocks.pop(i+1)
            else:
                i += 1

    def display_memory_map(self):
        print("\n===== MEMORY MAP =====")
        for block in self.blocks:
            print(block)
        
        # Calculate fragmentation
        free_blocks = [b for b in self.blocks if b.is_free]
        if free_blocks:
            external_fragmentation = len(free_blocks) - 1
            total_free = sum(b.size for b in free_blocks)
            fragmentation_percentage = (external_fragmentation / len(free_blocks)) * 100 if len(free_blocks) > 0 else 0
            print(f"\nTotal Memory: {self.total_memory} bytes")
            print(f"Free Memory: {total_free} bytes ({(total_free/self.total_memory)*100:.2f}%)")
            print(f"External Fragmentation: {external_fragmentation} gaps ({fragmentation_percentage:.2f}%)")
        else:
            print("\nNo free memory blocks available.")

# Demo
def run_demo():
    print("=== MEMORY MANAGEMENT DEMO ===")
    mm = MemoryManager(1024)  # 1KB of memory for demonstration
    
    mm.display_memory_map()
    
    # Allocate memory for different processes
    mm.allocate(1, 200, "first_fit")  # Process 1 needs 200 bytes
    mm.allocate(2, 300, "best_fit")   # Process 2 needs 300 bytes
    mm.allocate(3, 150, "worst_fit")  # Process 3 needs 150 bytes
    
    mm.display_memory_map()
    
    # Deallocate Process 2
    mm.deallocate(2)
    mm.display_memory_map()
    
    # Allocate more memory
    mm.allocate(4, 100, "first_fit")  # Process 4 needs 100 bytes
    mm.allocate(5, 50, "best_fit")    # Process 5 needs 50 bytes
    
    mm.display_memory_map()
    
    # Deallocate all processes
    mm.deallocate(1)
    mm.deallocate(3)
    mm.deallocate(4)
    mm.deallocate(5)
    
    mm.display_memory_map()

if __name__ == "__main__":
    run_demo()
#!/usr/bin/env python3

class Process:
    def __init__(self, pid, name, memory_required, cpu_time):
        self.pid = pid
        self.name = name
        self.memory_required = memory_required
        self.cpu_time = cpu_time
        self.status = 'ready'
        self.memory_allocated = 0
        self.cpu_used = 0

    def __str__(self):
        return f"Process {self.pid}: {self.name} (Status: {self.status}, Memory: {self.memory_allocated}/{self.memory_required}MB, CPU time: {self.cpu_used}/{self.cpu_time}s)"

class OperatingSystem:
    def __init__(self, total_memory=1024, cpu_cores=4):
        self.total_memory = total_memory  # MB
        self.available_memory = total_memory
        self.cpu_cores = cpu_cores
        self.processes = []
        self.running_processes = []
        self.terminated_processes = []
        self.process_counter = 0
        print(f"OS Simulator started with {total_memory}MB RAM and {cpu_cores} CPU cores")

    def create_process(self, name, memory_required, cpu_time):
        self.process_counter += 1
        new_process = Process(self.process_counter, name, memory_required, cpu_time)
        self.processes.append(new_process)
        print(f"Created: {new_process}")
        return new_process

    def allocate_memory(self, process):
        if self.available_memory >= process.memory_required:
            process.memory_allocated = process.memory_required
            self.available_memory -= process.memory_required
            process.status = 'allocated'
            print(f"Memory allocated: {process}")
            return True
        else:
            print(f"Not enough memory for {process.name}. Available: {self.available_memory}MB, Required: {process.memory_required}MB")
            return False

    def start_process(self, process):
        if process.status == 'allocated' and len(self.running_processes) < self.cpu_cores:
            process.status = 'running'
            self.running_processes.append(process)
            print(f"Started: {process}")
            return True
        elif len(self.running_processes) >= self.cpu_cores:
            print(f"No available CPU cores. Currently running {len(self.running_processes)} processes.")
            return False
        else:
            print(f"Process {process.name} is not ready to start. Status: {process.status}")
            return False

    def run_simulation(self, time_units):
        print(f"\nRunning simulation for {time_units} time units...")
        for _ in range(time_units):
            self._simulate_time_unit()
        print("\nSimulation complete.")
        self.system_status()

    def _simulate_time_unit(self):
        # Process execution
        for process in list(self.running_processes):
            process.cpu_used += 1
            if process.cpu_used >= process.cpu_time:
                self._terminate_process(process)

        # Try to start waiting processes
        for process in self.processes:
            if process.status == 'allocated':
                self.start_process(process)

        # Try to allocate memory to ready processes
        for process in self.processes:
            if process.status == 'ready':
                self.allocate_memory(process)

    def _terminate_process(self, process):
        process.status = 'terminated'
        self.running_processes.remove(process)
        self.terminated_processes.append(process)
        self.available_memory += process.memory_allocated
        print(f"Terminated: {process}")

    def system_status(self):
        print("\n===== SYSTEM STATUS =====")
        print(f"Memory: {self.available_memory}MB free out of {self.total_memory}MB")
        print(f"CPU: {len(self.running_processes)}/{self.cpu_cores} cores in use")
        
        print("\nRunning Processes:")
        if self.running_processes:
            for p in self.running_processes:
                print(f"  {p}")
        else:
            print("  None")
            
        print("\nWaiting Processes:")
        waiting = [p for p in self.processes if p.status in ['ready', 'allocated']]
        if waiting:
            for p in waiting:
                print(f"  {p}")
        else:
            print("  None")
            
        print(f"\nTerminated Processes: {len(self.terminated_processes)}")

# Demo simulation
def run_demo():
    print("=== OS SIMULATOR DEMO ===")
    os = OperatingSystem(total_memory=2048, cpu_cores=2)
    
    # Create some processes
    p1 = os.create_process("Web Browser", 512, 10)
    p2 = os.create_process("Text Editor", 128, 5)
    p3 = os.create_process("Video Player", 1024, 8)
    p4 = os.create_process("Game", 768, 12)
    
    # Initial status
    os.system_status()
    
    # Allocate memory
    os.allocate_memory(p1)
    os.allocate_memory(p2)
    os.allocate_memory(p3)
    
    # Start processes
    os.start_process(p1)
    os.start_process(p2)
    
    # Run simulation
    os.run_simulation(6)
    
    # Start more processes
    os.start_process(p3)
    os.allocate_memory(p4)
    os.start_process(p4)
    
    # Run more simulation
    os.run_simulation(10)

if __name__ == "__main__":
    run_demo()
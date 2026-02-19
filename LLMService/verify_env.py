
import sys
try:
    import torch
    print(f"Torch Version: {torch.__version__}")
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA Device: {torch.cuda.get_device_name(0)}")
except ImportError as e:
    print(f"Torch Import Error: {e}")

try:
    import auto_gptq
    print(f"AutoGPTQ Version: {auto_gptq.__version__}")
except ImportError as e:
    print(f"AutoGPTQ Import Error: {e}")

import os
import urllib.request
from langchain_openai import ChatOpenAI

print("--- System Proxy Diagnostics ---")
print(f"HTTP_PROXY: {os.environ.get('HTTP_PROXY')}")
print(f"HTTPS_PROXY: {os.environ.get('HTTPS_PROXY')}")
print(f"NO_PROXY: {os.environ.get('NO_PROXY')}")
print(f"urllib proxies: {urllib.request.getproxies()}")

try:
    print("\n--- Attempting to initialize ChatOpenAI ---")
    model = ChatOpenAI(
        model="gpt-3.5-turbo",
        openai_api_key="sk-dummy",
        temperature=0
    )
    print("Success!")
except Exception as e:
    print(f"Initialization Failed: {type(e).__name__}")
    print(str(e))
    # If it's a Pydantic error, let's see where 'proxies' might be hidden
    import traceback
    traceback.print_exc()

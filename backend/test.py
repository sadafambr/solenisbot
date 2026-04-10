import requests
r = requests.post("http://127.0.0.1:5000/ask-algo", json={"user_input":"give me 2 customers from customer table","conversation_history":[]}, timeout=120)
print(r.status_code, r.json())
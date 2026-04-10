import requests, json
url='http://localhost:5000/ask-algo'
body={'user_input':'Retrieve 2 records from the customer table.','conversation_history':[]}
try:
    r=requests.post(url,json=body,timeout=120)
    print('status',r.status_code)
    print(json.dumps(r.json(),indent=2))
except Exception as e:
    print('exc',e)

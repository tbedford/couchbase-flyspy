from flask import Flask, request, jsonify
from pprint import pprint
from uuid import uuid4
import os
from dotenv import load_dotenv

load_dotenv()
db_password = os.getenv("DB_PASSWORD")

def upsert_document(cb_coll, doc):
  print("\nUpsert CAS: ")
  try:
    # key will equal: "event_uuid"
    key = "event_" + str(uuid4())
    result = cb_coll.upsert(key, doc)
    print(result.cas)
  except Exception as e:
    print(e)

# needed for any cluster connection
from couchbase.cluster import Cluster, ClusterOptions
from couchbase_core.cluster import PasswordAuthenticator

# needed to support SQL++ (N1QL) query
from couchbase.cluster import QueryOptions

# get a reference to our cluster
cluster = Cluster('couchbase://localhost', ClusterOptions(
  PasswordAuthenticator('Administrator', db_password)))

# get a reference to our bucket
cb = cluster.bucket('flyspy')

# get a reference to the default collection
cb_coll = cb.default_collection()

url = None
app = Flask(__name__)

## API

@app.route("/", methods=['GET'])
def index():
    print('Fly spy')
    return ('Welcome to Fly Spy - Couchbase version', 200)

# Get event with severity  
@app.route("/events/<int:severity>", methods=['GET'])
def get_events_with_severity(severity):
    headers = {}  
    headers['Access-Control-Allow-Origin'] = '*'
    rows = cluster.query('SELECT * FROM flyspy WHERE severity == $1', severity)
    events = []
    for row in rows:
      pprint(row)
      events.append(row['flyspy'])
    return (jsonify(events), headers)

# Get all events  
@app.route("/events", methods=['GET'])
def get_events():
    headers = {}  
    headers['Access-Control-Allow-Origin'] = '*'
    rows = cluster.query('SELECT * FROM flyspy')
    events = []
    for row in rows:
      pprint(row)
      events.append(row['flyspy'])
    return(jsonify(events), headers)
  
## Application-level webhooks

@app.route("/webhooks/inbound", methods=['POST'])
def inbound():
    global url
    data = request.get_json()
    pprint(data) 
    type = data['message']['content']['type']
    if type == 'image':
        url = data['message']['content']['image']['url']
    elif type == 'text':
        m = data['message']['content']['text'].strip()
        if m.lower() == 'help':
            # send help message back to user
            print('Send image followed by location: description')
        else:
            location, description, severity = m.split(':')
            location = location.upper().strip()
            description = description.strip()
            severity = int(severity.strip())
            if url:
                # write record to database
                obj = {'location': location, 'url': url, 'description': description, 'severity': severity }
                upsert_document(cb_coll, obj)
                url = None
    return ("OK")

@app.route("/webhooks/status", methods=['POST'])
def status():
    data = request.get_json()
    pprint(data) 
    return ("OK")

if __name__ == "__main__":
    print("Running locally")
    app.run(host="localhost", port=9000)


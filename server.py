# server.py
from flask import Flask, render_template, jsonify, request
from datetime import datetime
import csv, os, time

app = Flask(__name__)

# Global variable to store latest data
latest_data = {
    "level": 0,
    "temp": 0,
    "ph": 0,
    "tds": 0,
    "timestamp": None
}

# CSV file to log data
CSV_FILE = "sensor_log.csv"
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp","level","temp","ph","tds"])

# -------------------- Routes --------------------

# Serve main dashboard
@app.route('/')
def index():
    return render_template("index.html")

# Serve historical analysis page without pandas
@app.route('/analysis')
def analysis():
    timestamps, levels, temps, phs, tds_values = [], [], [], [], []

    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                timestamps.append(row['timestamp'])
                levels.append(float(row['level']))
                temps.append(float(row['temp']))
                phs.append(float(row['ph']))
                tds_values.append(float(row['tds']))

    return render_template("analysis.html",
                           timestamps=timestamps,
                           levels=levels,
                           temps=temps,
                           phs=phs,
                           tds_values=tds_values)

# API endpoint to receive data from simulator
@app.route('/api/data', methods=['POST'])
def submit_data():
    global latest_data
    data = request.get_json()
    data["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    latest_data = data

    # Append to CSV
    with open(CSV_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([data["timestamp"], data["level"], data["temp"], data["ph"], data["tds"]])

    return jsonify({"status": "success"}), 200

# API endpoint for dashboard to fetch latest data
@app.route('/api/data', methods=['GET'])
def get_data():
    stale = False
    if latest_data["timestamp"]:
        data_age = (datetime.now() - datetime.strptime(latest_data["timestamp"], "%Y-%m-%d %H:%M:%S")).total_seconds()
        if data_age > 15:
            stale = True
    return jsonify({**latest_data, "stale": stale})

# -------------------- Main --------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
  

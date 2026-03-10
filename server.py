from flask import Flask, render_template, jsonify, request
from datetime import datetime
import csv
import os
app = Flask(__name__)
latest_data = {
    "level": 0,
    "percentage": 0,
    "tds": 0,
    "timestamp": None,
    "state": "OFFLINE"
}
CSV_FILE = "sensor_log.csv"
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp","level","percentage","tds","state"])
def classify_state(tds):
    if tds < 300:
        return "NORMAL"
    elif 300 <= tds <= 600:
        return "WARNING"
    elif 600 < tds <= 900:
        return "DANGER"
    else:
        return "CRITICAL"
@app.route('/')
def index():
    return render_template("index.html")
@app.route('/analysis')
def analysis():
    timestamps = []
    levels = []
    percentages = []
    tds_values = []
    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                timestamps.append(row["timestamp"])
                levels.append(float(row["level"]))
                percentages.append(float(row["percentage"]))
                tds_values.append(float(row["tds"]))
    return render_template(
        "analysis.html",
        timestamps=timestamps,
        levels=levels,
        percentages=percentages,
        tds_values=tds_values
    )
@app.route('/api/data', methods=['POST'])
def submit_data():
    global latest_data
    data = request.get_json()
    level = float(data["level"])
    percentage = float(data["percentage"])
    tds = float(data["tds"])
    state = classify_state(tds)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    latest_data = {
        "level": level,
        "percentage": percentage,
        "tds": tds,
        "timestamp": timestamp,
        "state": state
    }
    with open(CSV_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            timestamp,
            level,
            percentage,
            tds,
            state
        ])
    return jsonify({"status":"success"}),200
@app.route('/api/data', methods=['GET'])
def get_data():
    stale = True
    if latest_data["timestamp"]:
        data_age = (
            datetime.now()
            - datetime.strptime(latest_data["timestamp"], "%Y-%m-%d %H:%M:%S")
        ).total_seconds()
        if data_age < 30:
            stale = False
    return jsonify({
        "level": latest_data["level"],
        "percentage": latest_data["percentage"],
        "tds": latest_data["tds"],
        "state": latest_data["state"],
        "stale": stale
    })
if __name__ == "__main__":
    app.run(host="0.0.0.0",port=5000,debug=True)

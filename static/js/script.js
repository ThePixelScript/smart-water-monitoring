const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  themeToggle.innerText = document.body.classList.contains('dark-mode')
    ? '☀️ Light Mode'
    : '🌙 Dark Mode';
});

if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

function sendBrowserNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

const charts = {};
const sensors = ['level', 'temp', 'ph', 'tds'];
let lastState = null;
let staleNotified = false;
let blinkIntervals = {};

sensors.forEach(id => {
  const ctx = document.getElementById(id + 'Chart').getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: id.toUpperCase(),
        data: [],
        borderColor: '#0077ff',
        backgroundColor: 'rgba(0,119,255,0.2)',
        tension: 0.3,
        fill: true,
        pointRadius: 0
      }]
    },
    options: { scales: { x: { display: false } } }
  });
});

function updateSystemState(state) {
  const badge = document.getElementById("systemState");
  if (!state) {
    badge.innerText = "STATUS: OFFLINE";
    badge.style.background = "gray";
    return;
  }

  badge.innerText = `STATUS: ${state}`;
  badge.style.background =
    state === "NORMAL" ? "green" :
    state === "WARNING" ? "orange" :
    state === "DANGER" ? "red" :
    state === "CRITICAL" ? "darkred" :
    "gray";
}

function startBlink(chart) {
  if (blinkIntervals[chart]) return;
  let on = false;
  blinkIntervals[chart] = setInterval(() => {
    chart.data.datasets[0].backgroundColor =
      on ? 'rgba(255,0,0,0.25)' : 'rgba(255,0,0,0.05)';
    chart.update();
    on = !on;
  }, 600);
}

function stopBlink(chart) {
  if (blinkIntervals[chart]) {
    clearInterval(blinkIntervals[chart]);
    blinkIntervals[chart] = null;
    chart.data.datasets[0].backgroundColor = 'rgba(0,119,255,0.2)';
    chart.update();
  }
}

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error("Network error");
    const data = await response.json();
    if (data.stale) {
      updateSystemState(null);
      sensors.forEach(id => startBlink(charts[id]));
      if (!staleNotified) {
        showNotification("🔌 Device offline: No data received for 30 seconds", "danger", 15000);
        sendBrowserNotification(
          "Device Offline",
          "No sensor data received. Check power or network."
        );
        staleNotified = true;
      }
      return;
    }
    staleNotified = false;
    sensors.forEach(id => stopBlink(charts[id]));
    document.getElementById('levelValue').innerText = data.level + ' cm';
    document.getElementById('tempValue').innerText = data.temp + ' °C';
    document.getElementById('phValue').innerText = data.ph;
    document.getElementById('tdsValue').innerText = data.tds + ' ppm';
    updateSystemState(data.state);
    if (data.state !== lastState) {
      if (data.state === "WARNING") {
        showNotification("⚠️ Water quality warning detected");
      }
      if (data.state === "DANGER") {
        showNotification("🚨 Dangerous water quality detected!", "danger", 12000);
        sendBrowserNotification("Water Danger Alert", "Water contamination detected");
      }
      if (data.state === "CRITICAL") {
        showNotification("🆘 CRITICAL ALERT: Immediate action required!", "danger", 20000);
        sendBrowserNotification("CRITICAL WATER ALERT", "Severe contamination suspected");
      }
      lastState = data.state;
    }
    const time = new Date().toLocaleTimeString();
    sensors.forEach(id => {
      const chart = charts[id];
      chart.data.labels.push(time);
      chart.data.datasets[0].data.push(data[id]);
      if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update();
    });
  } catch (e) {
    console.error(e);
  }
}

setInterval(fetchData, 1500);

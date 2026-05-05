const data = {
  driver_id: 'driver-123',
  vehicle_id: 'vehicle-1',
  job_id: 'job-abc',
  job_type: 'routine',
  clusters: [{ cluster_id: 'c1', cluster_name: 'Cluster 1', address: '1 Main St' }],
  route: [{ sequence: 1, cluster_id: 'c1', cluster_name: 'Cluster 1', lat: -33.86, lng: 151.2, bins: ['b1','b2'], estimated_arrival: '2026-04-30T05:00:00Z' }],
  estimated_duration_min: 45,
  planned_weight_kg: 120,
  total_bins: 10,
};

async function run() {
  try {
    const res = await fetch('http://127.0.0.1:3004/internal/notify/job-assigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Request failed:', err);
  }
}

run();

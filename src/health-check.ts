// Health check script for Docker container
export {};
const response = await fetch('http://localhost:3000/health')
if (response.ok) {
  const data = await response.json()
  if (data && typeof data === 'object' && 'status' in data && data.status === 'healthy') {
    console.log('✅ Health check passed')
    process.exit(0)
  }
}
console.log('❌ Health check failed')
process.exit(1)

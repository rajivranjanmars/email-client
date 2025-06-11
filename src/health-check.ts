// Health check script for Docker container
const response = await fetch('http://localhost:3000/health')
if (response.ok) {
  const data = await response.json()
  if (data.status === 'healthy') {
    console.log('✅ Health check passed')
    process.exit(0)
  }
}
console.log('❌ Health check failed')
process.exit(1)

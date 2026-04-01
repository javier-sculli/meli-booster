import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

const getNgrokHost = () => {
  try {
    return process.env.MELI_REDIRECT_URI 
      ? new URL(process.env.MELI_REDIRECT_URI).hostname 
      : null
  } catch {
    return null
  }
}

const host = getNgrokHost()
if (host) {
  // @ts-ignore - allowedDevOrigins is not strongly typed in older Next.js types yet
  nextConfig.allowedDevOrigins = [host]
}

export default nextConfig

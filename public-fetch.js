import { lookup as resolveHost } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const MAX_REDIRECTS = 5

const LOCAL_NETWORKS = [
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'],
  ['224.0.0.0', 3, 'ipv4'],
  ['::', 127, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  ['ff00::', 8, 'ipv6'],
]

const localNetworks = new BlockList()
for (const [network, prefix, family] of LOCAL_NETWORKS) localNetworks.addSubnet(network, prefix, family)

const addressesOf = async (host) => (isIP(host) ? [{ address: host, family: isIP(host) }] : resolveHost(host, { all: true }))

const isRedirect = (status) => status >= 300 && status < 400

export async function assertPublicAddress(pageUrl) {
  const { protocol, hostname } = new URL(pageUrl)
  if (protocol !== 'http:' && protocol !== 'https:') throw new Error('Only http and https pages can be audited')
  const addresses = await addressesOf(hostname.replace(/^\[|\]$/g, ''))
  const local = addresses.some(({ address, family }) => localNetworks.check(address, family === 6 ? 'ipv6' : 'ipv4'))
  if (local) throw new Error('Only public pages can be audited: this address points to a local or private network')
}

export function createPublicFetch(fetcher = globalThis.fetch) {
  return async function publicFetch(input, init = {}) {
    let target = String(input)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicAddress(target)
      const response = await fetcher(target, { ...init, redirect: 'manual' })
      const location = response.headers.get('location')
      if (!isRedirect(response.status) || !location) return response
      await response.body?.cancel()
      target = new URL(location, target).href
    }
    throw new Error('The page redirects too many times')
  }
}

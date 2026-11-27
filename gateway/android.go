//go:build android

package gateway

// Android won't let an app list its network interfaces, and has no
// /etc/resolv.conf, so tsnet can neither find its endpoints nor resolve the
// control server. This feature fills in both; tsnet only links it on request.
import _ "tailscale.com/feature/androidbin"

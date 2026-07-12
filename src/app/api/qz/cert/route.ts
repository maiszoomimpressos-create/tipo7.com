// Certificado X.509 auto-assinado do tipo7.com para QZ Tray
// Fingerprint SHA1: FF36A5373096B6C31B2CF39F9D8422AD7514AD40
const CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUMmPeIL+jjahhImTD65F4qvukLtQwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJdGlwbzcuY29tMB4XDTI2MDcxMTEyNTgxOVoXDTM2MDcw
ODEyNTgxOVowFDESMBAGA1UEAwwJdGlwbzcuY29tMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAi8bJTsjD9Rivkmu7VsrGOetQHhUPjg9LUkMKd0Q85P6N
knC2nekHPBh7DSwxhcDe36GWVsrVJzbe5/MOfp9Zx0oB5AxmdtjSlwH82/V9+8ad
ME6s03Zq5XYjjafFqOf4U9XES96hjIuJ8ATqTsUQpmJXSswM27h7vYnkf33q5Cs9
M6V8T5Ib1/v84YlxZKFohEctUKE5TyC70aLNXiBeCgGz2Sk7uh69MnYJE8p5VLc6
ZM76GjB9mjIFsl5kt2pu0Klx5rLMbpUbQX7C16AqE1vQnHoajt0UT2iA8EDnBXJt
lh/EVggGXeqqxO2GzmQNdrx8m/EjGErPVHrehFCZUQIDAQABo1MwUTAdBgNVHQ4E
FgQUJBJ8pWrEZL7hurPY5AmFh9AHJvQwHwYDVR0jBBgwFoAUJBJ8pWrEZL7hurPY
5AmFh9AHJvQwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAM8Mq
nlOR4kqNnNjft7Gzv9ARVBZ1fQihp6IfzR8U11RqkfJARpbrR2MhiYk4cfzRs+xv
YyxyM/s/Tq5W0QPDPuzkLHntJ5oUL2uoJZvmdowS5tFuE9YfbYnPLa0ySa525dd1
rAdtEqSXT+GPGGGKtEWf+EkEIsVR9gNa9EmatTgS2b5H0tsSdkmf5njP7i2J1LSP
VrH8Dv+e4Qa3kdklHFxqClIDy0ohmqvkLQmGM7rhbT56KT01XQnTUHfJ8qAfigaM
6s6RoNPoG18nxNAdx2qXQLnxyratVt54LD2U4sHpm8wCaWxOHG1q5nS8whoB0IMQ
fpLuORYeoudOIjVqXQ==
-----END CERTIFICATE-----`

export async function GET() {
  return new Response(CERT, {
    headers: {
      'Content-Type': 'application/x-pem-file',
      'Content-Disposition': 'attachment; filename="tipo7-qztray.pem"',
      'Cache-Control': 'no-store',
    },
  })
}

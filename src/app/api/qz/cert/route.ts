// Certificado X.509 auto-assinado do tipo7.com para QZ Tray
// Fingerprint SHA1: 8404E0908051F5F44BA79734D83515D9C6FE0929
const CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUad/yJX/ePtbcJvWUF0pWS6dEgJgwDQYJKoZIhvcNAQEF
BQAwFDESMBAGA1UEAwwJdGlwbzcuY29tMB4XDTI2MDcxMTAxMTU1NFoXDTM2MDcw
ODAxMTU1NFowFDESMBAGA1UEAwwJdGlwbzcuY29tMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAnsE2Co9zlYu64D9lkUeOPnkqY2wBn6fX8oSZxGraHD7c
hKYaaVBNkStnBBiTnvaNonZlUHmGrzGLb4AnFwFG8BAXC6U2a3876MJ0wftFw3Sn
AxrH2hxAMpGL6DKuJpf/7yu4WULjly059pntsDLfaYnKvbz+5bSyNjt/HAGakRCm
vZIvyQbFRViU2hgQHlJa00wpLVZ3Gci96RehkOgYELoz6YZ/CHfw+57RetVK+JD9
Zu4Lhqt6yY1OS1yMWfA9EPNm/eny0Pgbggx94MHUmPyKAUgl6FWGqpjLhJ13HNbE
qqHbliZYqIYuHU+VzVVvc2rGUDzGMdgTN0JEXl2xDQIDAQABo1MwUTAdBgNVHQ4E
FgQUMwAvqOmxEzU4mAu2mwzvuYqaA7EwHwYDVR0jBBgwFoAUMwAvqOmxEzU4mAu2
mwzvuYqaA7EwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQUFAAOCAQEAO0Di
dBoRWE8rHDyjsSgKhDl63aBPNS3xKEUPPEnozVgEgXOMI39tlGNIgQhzCC1r2Q2r
hGjHVbzOLXxuMh6cUL3ioRLtgZHT06xKzq1samVyMn0fbf1fQnR+zNghvsTFKHo9
TWzeoXsX+/TE6UPT9+avdD6vV9RdbJbH1H7BRVysbcJ305BzetdKXS/98cT8egun
E46kBYOAbcinGJgkSQxa9N7d3ueAFscukSHuG++2m3m8sMIiodSvywqI6A8ThLVd
cDbFwLDcIV3DKu3qNxylwti/p+Ldot9rGOYIMgEBsb/ojlHBX2ej+gkZ03+svuJm
JunwLil8SL1UKNu/fg==
-----END CERTIFICATE-----`

export async function GET() {
  return new Response(CERT, {
    headers: {
      'Content-Type': 'application/x-pem-file',
      'Content-Disposition': 'attachment; filename="tipo7-qztray.pem"',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>IRIS Search</ShortName>
  <Description>Privacy-respecting meta-search engine</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="32" height="32" type="image/x-icon">${origin}/favicon.ico</Image>
  <Url type="text/html" method="get" template="${origin}/IRIS-search?q={searchTerms}" />
</OpenSearchDescription>`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/opensearchdescription+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}

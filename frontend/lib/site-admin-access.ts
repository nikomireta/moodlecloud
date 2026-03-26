"use client"

import { api, type SiteAdminAccessLinkResponse } from "@/lib/api"

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function writeAutoSubmitForm(target: Window, response: SiteAdminAccessLinkResponse) {
  const action = escapeHTML(response.login_url)
  const token = escapeHTML(response.access_token)
  target.document.open()
  target.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="referrer" content="no-referrer" />
    <title>Masuk sebagai admin</title>
  </head>
  <body>
    <form id="moodlepilot-admin-access" method="POST" action="${action}">
      <input type="hidden" name="t" value="${token}" />
    </form>
    <script>
      document.getElementById('moodlepilot-admin-access').submit();
    </script>
  </body>
</html>`)
  target.document.close()
}

function submitAdminAccessFormInCurrentWindow(response: SiteAdminAccessLinkResponse) {
  const form = document.createElement("form")
  form.method = "POST"
  form.action = response.login_url
  form.style.display = "none"

  const tokenInput = document.createElement("input")
  tokenInput.type = "hidden"
  tokenInput.name = "t"
  tokenInput.value = response.access_token
  form.appendChild(tokenInput)

  document.body.appendChild(form)
  form.submit()
  form.remove()
}

export async function openSiteAdminAccessLink(siteID: string): Promise<SiteAdminAccessLinkResponse> {
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null

  if (popup) {
    popup.opener = null
  }

  try {
    const response = await api.issueSiteAdminAccessLink(siteID)

    if (popup && !popup.closed) {
      writeAutoSubmitForm(popup, response)
      return response
    }

    submitAdminAccessFormInCurrentWindow(response)
    return response
  } catch (error) {
    if (popup && !popup.closed) {
      popup.close()
    }
    throw error
  }
}

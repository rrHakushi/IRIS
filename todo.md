# Borealis [Media tracker]
    - Stremio plugin for borealis
    - In media pages (anime, manga etc) add tab People in which it will list all users who have that media in list (that is public and media is not private)
    - Connection update fail notifications are not sent
    - On /increment routes, when a media progress is incremented and status is not watching, playing, reading etc it should be set to it


# Akaromi [Password manager]
    - Clicking unlock in the inline fill doesnt open the modal on android
    - Fix scan QR code (doesnt detect them)
    
# Kiroshi [Web search]
    - 

# Carina [Account management]
    - Web extension for managing and using bookmarks


# Lynx [Discord bot]
    - Copy from Runa and update
    - Borealis integration

# Iris [Core app]
    - Dev tools (floating popup like nextjs has), onclick open sidebar with tools [metadata viewer, send notification, trigger events/workers... ]
    - .md version of every single page
    - mcp server for all the apps
    - create missing sidebar configs
    - Default banner image for all apps (each different) to be used in server metadata 


# Apertune [Music player]
    - 

# Reliquary [Docs, guides etc]  !! Priority
    - Pages saved as json in db and rendered using iris-page
    - Pages editable only by admins and its owner/creator
    - Allow other logged in users to suggest edits (which should be approved by admin/document owner/creator)
    - structure:  /reliquary - homepage: list last visited docs, bookmarked docs, list all owned docs
                  /reliquary/browse - search all docs, separated by categories [Api docs, Wiki, guides...]   
                  /reluquary/documents/:id - Edit/view doc
    - sidebar config:  Section: "", items: ["home", "browse"], Section: "{doc title}", items: ["{subdoc name}": (children)]


# Spica [Chatting]
    - 

# Astra [Email client]
    - 

# Amadeus [Cloud storage and stuff]
    -

# Tesseract [Local network file sharing] (may be renamed later)
    - https://www.local-share.com/
    - https://web.localsend.org/
    - stea... borrow ideas from the above two


# Vex [Link shortener]
    -

# Nyxis [Financial tracking]
    - scan receipts and extract place, items and its prices, date, total, tax
    - banknote counter (eur, usd, cad, jpy, rmb, czk) [use their images and values]

# Elysia [Backend powering all this]
    --- Elysia 2 docs https://next.elysiajs.com/at-glance/

# Next
    - pnpm add @elysia/eden@next if not already
    - pnpm add -d elysia@rc  (Need Elysia to infer utility types)


### Plugins

# JellyCarina
    - OIDC plugin for jellyfin
    - https://github.com/jellyfin/jellyfin-plugin-template

# JellyBorealis 
    - Add support for other list (idk we'll see)
    - detect music button in the player ui (next to borealis icon) to detect currently playing music in the playback
# Akaromi For Firefox
    - 

# Borealis Extra
    - Add support for other list
    - https://github.com/accntech/shad-ui  for the UI




TODO AFTER UPDATNG TO LATEST
  run migrate-passwords
  run update-description-urls
  run db:prepare-prisma8
  run db:unify-status
# Borealis [Media tracker]
    - Stremio plugin for borealis
    - In media pages (anime, manga etc) add tab People in which it will list all users who have that media in list (that is public and media is not private)
   
# Akaromi [Password manager]
    - Clicking unlock in the inline fill doesnt open the modal on android
    - Fix scan QR code (doesnt detect them)
    - make dashboard page (/), move current / page to /vault
    - password sharing, to another user's vault, by url (one time use / expiry time), custom expiration times
    - add sensitive notes (content visible on focus/active input)
    
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
    - disable ws and public route logs (show only in dev)

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
    - inline fill doesnt filter by detection method
    - add search ti inline fill which will not filter out by website (just search normally like in the ui)
    - 

# Borealis Extra
    - Add support for other list




TODO AFTER UPDATNG TO LATEST
  run migrate-passwords  #done
  run vault:migrate-keys # done
  run update-description-urls  #done
  run db:prepare-prisma8   #done
  run db:unify-status  #done

  update oauth callback urls https://[url]/carina/connections/[provider]/callback #done
# Borealis [Media tracker]
    - Stremio plugin for borealis
    - Link manga list entries to books since its kinda the same


    
# Akaromi [Password manager]
    - password sharing, to another user's vault, by url (one time use / expiry time), custom expiration times
    
# Kiroshi [Web search]
    - 

# Carina [Account management]
    - Web extension for managing and using bookmarks
    - Update login/register pages
    - Add customs apps to applications in user menu ( user enters url and title, onClick redirect to that url, use favicon as icon )


# Lynx [Discord bot]
    - Copy from Runa and update
    - Borealis integration

# NamelessLiberty
    - Dev tools (floating popup like nextjs has), onclick open sidebar with tools [metadata viewer, send notification, trigger events/workers... ]
    - .md version of every single page
    - mcp server for all the apps
    - New app icons 

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

# Elysia 
    --- Elysia 2 docs https://next.elysiajs.com/at-glance/

    - RE existing elysia openapi plugin and create custom version of it

# Next
    - 


### Plugins

# JellyCarina
    - OIDC plugin for jellyfin
    - https://github.com/jellyfin/jellyfin-plugin-template

# JellyBorealis 
    - Add support for other list (idk we'll see)
    - detect music button in the player ui (next to borealis icon) to detect currently playing music in the playback

# BorealisReader
    - cross-platform epub reader
    - folders
    - sync reading progress with borealis
        - when a book is opened, prompt with a search to link it to a borealis entry (if not already)
        - select on which chapters/page to actually increment progress
        - when finished reading show a popup to either increment volume or set status to finished
        - if a folder is linked to entry instead then all books in that folder will be linked to the same entry 

# Akaromi For Firefox
    - in inline fill when searching fill doesnt work (works kinda but only on stuff that is domain matched and not anything like it should)
    - Unlocking outside the main extension window throws Unauthorized sender context 
    - Remove Akaromi Logins *Count text from inline
    - Remove text high-security, zero-knowledge... from settings

# Borealis Extra
    - Add support for other list




TODO AFTER UPDATNG TO LATEST
  run migrate-passwords  #done
  run vault:migrate-keys # done
  run update-description-urls  #done
  run db:prepare-prisma8   #done
  run db:unify-status  #done

  update oauth callback urls https://[url]/carina/connections/[provider]/callback #done
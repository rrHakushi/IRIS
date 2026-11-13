# Borealis [Media tracker]
    - Stremio plugin for borealis
    - Link manga list entries to books since its kinda the same


    
# Akaromi [Password manager]
    - 
    
# Kiroshi [Web search]
    - 

# Carina [Account management]
    - Web extension for managing and using bookmarks
    - Update login/register pages

# Lynx [Discord bot]
    - Copy from Runa and update
    - Borealis integration

# NamelessLiberty
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

# Tesseract [Local network file sharing]
    - 


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
    - 

# Borealis Extra
    - Add support for other list


# background
- have many resources on different location
    - location
        - NAS on VPS
        - PCs (Mac, Linux, Chromebook, Windows)
        - mobile (iOS and Android)
        - online provider (eg. Steam, DLSite, BookWalker, Kindle, some website)
    - resources
        - ebook (pdf, epub, azw3, txt, mobi)
        - music (flac, mp3, wav+cue)
        - pic (zip, jpg, png...)
        - video (mp4)
        - game (windows bin)
        - ebooks via online viewer
- have duplicate resources
- do not know some resources have be owned or not, and where they are

# target
- want a solution that managing the resources with following features
    - resources inventory
        - add, filter, update, remove resource list
        - find out duplicate resources
            - allow remote removal of non online provider resources with confirmation
    - resources viewer
        - enjoy resources on other platform
        - progress tracker
    - backend and frontend separation
        - cross device

# idea of solution
- should follow software engineering best practice like SOLID, KISS etc with reasoning
- backend use Ruby without rails
    - db: postgresql OR sqlite
        - should have common query interface, db is transparent
    - dockerized
    - as a relay to let client share resources by p2p
    - plugin based, like video resource as a plugin
        - plugin will have its own controller
    - db schema should define by plugin
    - can easily extend feature by update/add plugins
        - hot reload should be supported
    - core provide basic feature only, like db management, common api, plugin management
- frontend need cross device
    - web, electron(desktop)
    - only desktop can use moonlight for game stream playing
    - embed webview for some online provider progress tracking
    - embed ebook viewer
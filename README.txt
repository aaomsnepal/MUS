kkpramod.com.np — aaomsPrint / aaomsDigital / Digital Gurukul
=============================================================

Plain Node.js + Express. One dependency (express). No database — everything
is stored as JSON files inside /data, which makes backup a simple folder copy.

FOLDERS
-------
  server.js              all routes and APIs
  public/                every page and asset
  public/assets/         css, js, logo, product images
  data/                  knowledge.json, jobs, clients, designs, printers,
                         pricing, products, orders, posts, messages, faq
  data/uploads/          photos and logos uploaded in the card studio
  data/media/            images, video and audio used in Gurukul posts
  data/product-files/    the actual files buyers download (never public)
  agent/                 local print agent for the Evolis PC

API SUMMARY
-----------
  Terminal   GET  /api/boot  /api/stream        POST /api/ask
  Auth       POST /api/admin/login              (PIN → token)
  Print      GET  /api/print/printers  /pricing  /designs  /track/:code
             POST /api/print/quote  /jobs  /designs  /upload
  Store      GET  /api/store/products  /config  /faq
             POST /api/store/razorpay/order  /razorpay/verify
             POST /api/store/paypal/order    /paypal/capture
             GET  /api/store/download/:token
  Posts      GET  /api/posts  /api/posts/:slug
  Contact    POST /api/contact
  Admin      /api/admin/jobs  /clients  /products  /orders  /posts
             /messages  /printers  /pricing  /stats  /knowledge  /media
  Agent      GET  /api/agent/next     POST /api/agent/status
  SEO        /robots.txt  /sitemap.xml  /llms.txt

CARD STUDIO NOTES
-----------------
Cards are CR-80, 85.6 × 53.98 mm. The preview and the export use the same
drawing code, so the printed card matches the screen exactly. Exports are
300 or 600 dpi PNG, print-ready PDF at true mm size, or a print sheet that
goes straight to the printer at 1:1.

Printer profiles (Evolis, Zebra, Fargo/HID, Magicard, Nisca) set dpi, bleed
and duplex. Editing them in /admin changes what the studio exports.

BATCH
-----
Upload a CSV with a header row, map the columns once, and every card is
generated at once — download as ZIP or PDF, or send the whole batch to the
print queue. A column named photo/image/picture may hold a per-person image URL.

SECURITY
--------
Payment secrets live only in environment variables. Downloadable product files
sit outside the public folder and are served only against a paid token that
expires after seven days.

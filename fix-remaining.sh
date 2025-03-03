#!/bin/bash

# Fix remaining pages
for page in ErgenekonEpic.html MacShortcuts.html denemesayfası.html yedekblog.html; do
  # Add EmailJS
  sed -i '' '/<head>/,/<\/head>/ {
    /<meta content="" name="description">/a\
\
  <!-- EmailJS Library -->\
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>\
  <script type="text/javascript">\
    (function() {\
      emailjs.init("sr9_9CUgd0L641ObN");\
    })();\
  </script>
  }' "$page"
  
  # Fix background image URLs
  sed -i '' 's/background-image: url(img\/image (21).png)/background-image: url('\''img\/image\\ \\(21\\).png'\'')/g' "$page"
  sed -i '' 's/background-image: url(img\/overlay-bg.jpg)/background-image: url('\''img\/overlay-bg.jpg'\'')/g' "$page"
  
  echo "Fixed $page"
done

echo "All remaining pages have been fixed!" 
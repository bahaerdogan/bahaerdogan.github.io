#!/bin/bash

# Fix background image URLs and add EmailJS to all blog pages

# List of blog pages
BLOG_PAGES=(
  "DeservingMoney.html"
  "ErgenekonEpic.html"
  "MacShortcuts.html"
  "PreciousMetalData.html"
  "WhyToLearnHistory.html"
  "denemesayfası.html"
  "yedekblog.html"
)

# EmailJS script to add
EMAILJS_SCRIPT='  <!-- EmailJS Library -->
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
  <script type="text/javascript">
    (function() {
      emailjs.init("sr9_9CUgd0L641ObN");
    })();
  </script>'

# Process each blog page
for page in "${BLOG_PAGES[@]}"; do
  echo "Processing $page..."
  
  # Check if EmailJS is already included
  if ! grep -q "emailjs.init" "$page"; then
    # Add EmailJS script after the first </script> tag
    sed -i '' "/<\/script>/a\\
${EMAILJS_SCRIPT}
" "$page"
    echo "  Added EmailJS to $page"
  fi
  
  # Fix background image URLs
  sed -i '' 's/background-image: url(img\/image (21).png)/background-image: url('\''img\/image\\ \\(21\\).png'\'')/g' "$page"
  sed -i '' 's/background-image: url(img\/overlay-bg.jpg)/background-image: url('\''img\/overlay-bg.jpg'\'')/g' "$page"
  
  echo "  Fixed background image URLs in $page"
done

echo "All blog pages have been updated!" 
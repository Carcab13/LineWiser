#!/bin/bash

# Set compression quality (0-100)
QUALITY=80

for img in *.{jpg,jpeg,png,tiff}; do
    # Skip if no matching files exist in the folder
    [ -e "$img" ] || continue

    # Define the target output name
    filename="${img%.*}"
    output="${filename}.webp"

    # 1. CHECK: Skip if the .webp file already exists
    if [ -f "$output" ]; then
        echo "Skipping $img: $output already exists."
        continue
    fi

    echo "Converting $img..."

    # 2. CONVERT: Run the conversion command
    if cwebp -q $QUALITY "$img" -o "$output"; then
        # 3. REPLACE: Delete original only after successful conversion
        rm "$img"
        echo "Successfully replaced $img with $output"
    else
        echo "Error: Failed to convert $img. Original preserved."
    fi
done

echo "Batch processing complete."

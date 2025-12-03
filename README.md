# Google Takeout Photos Organizer

[![npm version](https://badge.fury.io/js/google-takeout-photos-organizer.svg)](https://www.npmjs.com/package/google-takeout-photos-organizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Organize your Google Takeout photo exports by year and album, with full EXIF metadata.

## Quick Start

1. Download your [Google Takeout](https://takeout.google.com/) (select Google Photos only)
2. Place all ZIP files in a folder
3. Run:
   ```bash
   cd /path/to/your/takeout-zips
   npx google-takeout-photos-organizer
   ```
4. Find your organized photos in `./Google Photos/`

## What You Get

```
Google Photos/
├── 2012/              # Photos organized by year
├── 2013/
├── 2014/
├── ...
├── Vacation 2023/     # Your albums preserved
├── Family/
├── Screenshots/
└── unknown/           # Photos without date metadata
```

Same photo appears in both its year folder AND album folder (using hard links to save disk space).

## Features

- **Automatic Extraction** — Unpacks all `takeout-*.zip` files
- **Smart Organization** — Photos sorted by year AND album
- **Full EXIF Metadata** — Dates, GPS coordinates, descriptions written to files
- **Space Efficient** — Uses hard links so album copies don't use extra space
- **Duplicate Handling** — Preserves all variants (`photo.jpg`, `photo(1).jpg`, etc.)
- **Progress Tracking** — Phase-by-phase progress with file counts
- **Detailed Logging** — Full logs for troubleshooting

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <dir>` | Folder containing ZIP files | Current directory |
| `-o, --output <dir>` | Output folder | `./Google Photos` |
| `-h, --help` | Show help | |
| `-V, --version` | Show version | |

## Examples

```bash
# Process ZIPs in current directory
npx google-takeout-photos-organizer

# Specify input and output directories
npx google-takeout-photos-organizer -i ~/Downloads/takeout -o ~/Pictures/Organized

# Show help
npx google-takeout-photos-organizer --help
```

## Requirements

- **Node.js 24** or higher
- **Disk space**: ~2x your Takeout size (for extraction + organized output)

## How It Works

The tool processes your photos in 6 phases:

| Phase | What Happens |
|-------|--------------|
| 1. Extract | Unpacks all `takeout-*.zip` files to a staging area |
| 2. Discover | Finds photos/videos and matches them with metadata JSON |
| 3. Analyze | Detects duplicates and calculates date ranges |
| 4. Organize | Copies files to year folders, creates hard links for albums |
| 5. EXIF | Writes metadata directly into photo files |
| 6. Timestamps | Sets file dates to match when photos were taken |

## EXIF Metadata Written

| Tag | Source |
|-----|--------|
| `DateTimeOriginal` | When the photo was taken |
| `CreateDate` | Creation timestamp |
| `GPSLatitude/Longitude` | Geolocation (if available) |
| `GPSAltitude` | Altitude (if available) |
| `ImageDescription` | Photo description from Google Photos |
| `Title` | Photo title |
| `Keywords` | Album names |

## Supported File Types

**Photos:** JPG, JPEG, PNG, GIF, HEIC, HEIF, WEBP, BMP, TIFF, RAW, CR2, NEF, ARW, DNG

**Videos:** MP4, MOV, AVI, MKV, WEBM, 3GP, M4V

## Troubleshooting

### "No ZIP files found"

Make sure you're in the folder containing `takeout-*.zip` files, or use `-i` to specify the path:

```bash
npx google-takeout-photos-organizer -i /path/to/zips
```

### "EXIF write failed" for some files

Some file formats don't support EXIF metadata. The tool continues processing other files.

### Processing seems stuck

Large exports can take a while. Check progress in `./logs/processing.log`.

### Need verbose output?

```bash
LOG_LEVEL=debug npx google-takeout-photos-organizer
```

## Logs

After processing, check:

- `./logs/processing.log` — Full operation log (JSON format)
- `./logs/errors.log` — Errors and warnings only

## Advanced Configuration

For power users, create a `config/default.json` file:

```json
{
  "input": {
    "zipDirectory": ".",
    "zipPattern": "takeout-*.zip"
  },
  "output": {
    "stagingDir": ".takeout-staging",
    "outputDir": "Google Photos",
    "byYearSubdir": "",
    "byAlbumSubdir": "",
    "unknownYearFolder": "unknown"
  },
  "processing": {
    "concurrency": 5,
    "useHardLinks": true,
    "fallbackToCopy": true
  },
  "exif": {
    "writeGPS": true,
    "writeDescription": true,
    "writeKeywords": true,
    "writeDateTimeOriginal": true
  }
}
```

## How Albums Work

Google Takeout exports photos in album folders. This tool:

1. **Copies** each photo to a year folder (e.g., `2023/photo.jpg`)
2. **Hard links** the same file in the album folder (e.g., `Vacation/photo.jpg`)

Hard links mean the file appears in both places without using extra disk space. Editing one edits both.

## Year Detection Priority

The tool determines the year using:

1. `photoTakenTime` — When the photo was actually taken (preferred)
2. `creationTime` — When uploaded to Google Photos
3. Filename pattern — Dates like `2023-01-15` in filename
4. File modification time — Last resort
5. `unknown/` folder — If all methods fail

## Performance

Expected time for ~20,000 files (56GB):

| Phase | Time |
|-------|------|
| Extraction | ~2 min |
| Discovery | <1 sec |
| Analysis | <10 sec |
| Organization | ~1.5 min |
| EXIF Writing | ~2.5 min |
| Timestamps | <5 sec |
| **Total** | **~6 min** |

## Installation Alternatives

### Global install

```bash
npm install -g google-takeout-photos-organizer
google-takeout-photos-organizer
```

### From source

```bash
git clone https://github.com/Flo5k5/google-takeout-photos-organizer.git
cd google-takeout-photos-organizer
npm install
npm run build
npm start
```

### Development

```bash
npm run dev  # Runs with tsx, no build needed
```

## License

MIT — see [LICENSE](LICENSE)

## Author

**Florian NOURRISSE** — [GitHub](https://github.com/Flo5k5)

## Contributing

Contributions welcome! Please submit a Pull Request.

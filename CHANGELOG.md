# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-03

### Added

- **Automatic ZIP extraction** - Unpacks all `takeout-*.zip` files with ZIP bomb protection
- **Smart photo organization** - Photos sorted into year folders (2012/, 2013/, etc.)
- **Album preservation** - Albums maintained as separate folders using hard links
- **Full EXIF metadata writing**:
  - DateTimeOriginal and CreateDate
  - GPS coordinates (latitude, longitude, altitude)
  - Image descriptions and titles
  - Album names as keywords
- **Duplicate detection** - Handles photo variants (`photo.jpg`, `photo(1).jpg`)
- **File timestamp correction** - Sets file dates to match when photos were taken
- **Progress tracking** - Phase-by-phase progress with file counts
- **Detailed logging** - JSON logs for troubleshooting
- **CLI interface** with input/output directory options
- **Support for 20+ file formats**:
  - Photos: JPG, JPEG, PNG, GIF, HEIC, HEIF, WEBP, BMP, TIFF, RAW, CR2, NEF, ARW, DNG
  - Videos: MP4, MOV, AVI, MKV, WEBM, 3GP, M4V

### Technical Details

- 6-phase processing pipeline (Extract → Discover → Analyze → Organize → EXIF → Timestamps)
- Hard links for space-efficient album copies
- Configurable via `config/default.json`
- Requires Node.js 24+

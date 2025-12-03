# Contributing to Google Takeout Photos Organizer

Thanks for your interest in contributing!

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/Flo5k5/google-takeout-photos-organizer.git
   cd google-takeout-photos-organizer
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

## Code Quality

Before submitting a PR, ensure your code passes all checks:

```bash
npm run check  # Runs lint + format check + type check
```

To auto-fix issues:

```bash
npm run lint:fix   # Fix ESLint issues
npm run format     # Format with Prettier
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `npm run check` to verify code quality
5. Commit your changes with a descriptive message
6. Push to your fork and open a Pull Request

## Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/Flo5k5/google-takeout-photos-organizer/issues) with:

- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Your Node.js version and OS
- Relevant log output from `./logs/`

## Project Structure

```
src/
├── index.ts          # CLI entry point
├── constants.ts      # Configuration constants
├── phases/           # 6 processing phases
├── services/         # Core business logic
├── types/            # TypeScript definitions
└── utils/            # Utility functions
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

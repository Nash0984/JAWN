# Contributing to Maryland Benefits Navigator

Thank you for your interest in contributing to the Maryland Benefits Navigator! This platform helps Maryland residents access government benefits and tax assistance, and we welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Submitting Issues](#submitting-issues)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Coding Standards](#coding-standards)
- [License Agreement](#license-agreement)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We are committed to providing a welcoming and inspiring community for all.

**Our Standards:**
- Be respectful and inclusive
- Welcome diverse perspectives and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

Before you begin:
- Ensure you have Node.js (v20+) installed
- Familiarize yourself with TypeScript, React, and Express
- Review the project documentation in the `/docs` directory
- Join our community discussions (if applicable)

## Development Setup

### Prerequisites

- Node.js 20+ 
- npm or pnpm
- PostgreSQL (for database features)

### Installation

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/yourusername/maryland-benefits-platform.git
   cd maryland-benefits-platform
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Configure required environment variables (DATABASE_URL, API keys, etc.)

4. **Initialize the database:**
   ```bash
   npm run db:push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Run tests:**
   ```bash
   npm test
   ```

The application will be available at `http://localhost:5000`

### Project Structure

```
maryland-benefits-platform/
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utility functions
├── server/              # Backend Express server
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   └── middleware/      # Express middleware
├── shared/              # Shared types and schemas
└── tests/               # Test files
```

## How to Contribute

### Types of Contributions

We welcome many types of contributions:

1. **Bug Fixes** - Fix issues or bugs in the codebase
2. **New Features** - Add new functionality
3. **Documentation** - Improve or add documentation
4. **Tests** - Add or improve test coverage
5. **Performance** - Optimize existing code
6. **Accessibility** - Improve accessibility features
7. **Security** - Report or fix security vulnerabilities

## Submitting Issues

### Bug Reports

When submitting a bug report, please include:

1. **Clear title** - Describe the issue concisely
2. **Description** - Detailed explanation of the bug
3. **Steps to reproduce** - How to replicate the issue
4. **Expected behavior** - What should happen
5. **Actual behavior** - What actually happens
6. **Environment** - Browser, OS, Node version, etc.
7. **Screenshots** - If applicable

**Example:**
```markdown
**Title:** Login form validation fails on special characters

**Description:** When entering a password with special characters (!@#$), the login form shows an error.

**Steps to reproduce:**
1. Go to /login
2. Enter username: test@example.com
3. Enter password: Test@123!
4. Click "Login"

**Expected:** User should be logged in
**Actual:** Error message "Invalid password format"

**Environment:** Chrome 118, Windows 11, Node 20.10.0
```

### Feature Requests

For feature requests, please include:

1. **Problem statement** - What problem does this solve?
2. **Proposed solution** - How should it work?
3. **Alternatives considered** - Other approaches you've thought about
4. **Additional context** - Screenshots, mockups, examples

## Submitting Pull Requests

### Before Submitting a PR

1. **Check existing issues** - Is there an issue for this change?
2. **Create an issue first** - For significant changes, discuss with maintainers
3. **Update your fork** - Ensure your fork is up to date with main
4. **Create a feature branch** - Use a descriptive branch name

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added or updated for changes
- [ ] Documentation updated (if needed)
- [ ] All tests pass (`npm test`)
- [ ] No console errors or warnings
- [ ] LSP/TypeScript errors resolved
- [ ] Commits are clear and descriptive
- [ ] PR description explains the changes

### PR Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes:**
   - Write clean, maintainable code
   - Follow existing patterns and conventions
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```
   
   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

4. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request:**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template
   - Link related issues

6. **Address review feedback:**
   - Respond to reviewer comments
   - Make requested changes
   - Push updates to your branch

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types, avoid `any`
- Use interfaces for object shapes
- Leverage type inference when possible

### React

- Use functional components with hooks
- Follow React best practices
- Use proper prop types
- Implement proper error boundaries
- Add `data-testid` attributes for testing

### Code Style

- Use ESLint and Prettier (configured in project)
- Follow existing code patterns
- Keep functions small and focused
- Write self-documenting code
- Add comments for complex logic

### Testing

- Write unit tests for utilities and services
- Write integration tests for API routes
- Write E2E tests for critical user flows
- Aim for meaningful test coverage
- Follow Arrange-Act-Assert pattern

### Security

- Never commit secrets or API keys
- Sanitize user inputs
- Follow HIPAA compliance guidelines
- Use parameterized queries (prevent SQL injection)
- Implement proper authentication/authorization

### Accessibility

- Follow WCAG 2.1 AA standards
- Use semantic HTML
- Provide proper ARIA labels
- Ensure keyboard navigation works
- Test with screen readers

## License Agreement

**By contributing to this project, you agree that:**

1. Your contributions will be licensed under the same [MIT License](LICENSE) that covers the project
2. You have the right to submit the contribution under this license
3. You understand that your contributions are public and may be redistributed

### Developer Certificate of Origin

By making a contribution to this project, you certify that:

- The contribution was created in whole or in part by you and you have the right to submit it under the open source license indicated in the file; or
- The contribution is based upon previous work that, to the best of your knowledge, is covered under an appropriate open source license and you have the right under that license to submit that work with modifications; or
- The contribution was provided directly to you by some other person who certified (a), (b) or (c) and you have not modified it.

## Questions?

If you have questions about contributing:

- **Email:** developers@marylandbenefits.org
- **GitHub Issues:** [Open a discussion](https://github.com/yourusername/maryland-benefits-platform/issues)
- **Documentation:** Check the `/docs` directory

## Recognition

Contributors will be recognized in our:
- README.md Contributors section
- Release notes for significant contributions
- Project documentation

Thank you for helping make government benefits more accessible to Maryland residents! 🏛️

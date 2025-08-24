# GitHub Integration Setup Guide

This guide will help you set up GitHub OAuth integration for your AI-IDE.

## Prerequisites

- A GitHub account
- Node.js and npm installed
- The AI-IDE project running locally

## Step 1: Create a GitHub OAuth App

1. **Go to GitHub Settings**
   - Log in to your GitHub account
   - Click on your profile picture → Settings
   - In the left sidebar, click "Developer settings"
   - Click "OAuth Apps"
   - Click "New OAuth App"

2. **Fill in the OAuth App details**
   - **Application name**: `AI-IDE` (or any name you prefer)
   - **Homepage URL**: `http://localhost:8080`
   - **Application description**: `AI-IDE with GitHub Integration`
   - **Authorization callback URL**: `http://localhost:8080/github/callback`

3. **Register the application**
   - Click "Register application"
   - You'll be redirected to your new OAuth App page

4. **Copy the credentials**
   - **Client ID**: Copy this value
   - **Client Secret**: Click "Generate a new client secret" and copy the generated value

## Step 2: Update the GitHub Service Configuration

1. **Open the GitHub service file**
   ```bash
   code dev-opal/src/services/githubService.ts
   ```

2. **Update the OAuth configuration**
   Replace the placeholder values with your actual GitHub OAuth App credentials:
   ```typescript
   private readonly CLIENT_ID = 'your_actual_client_id_here';
   private readonly CLIENT_SECRET = 'your_actual_client_secret_here';
   ```

3. **Save the file**

## Step 3: Test the Integration

1. **Start your AI-IDE**
   ```bash
   npm run dev
   ```

2. **Open the IDE in your browser**
   - Navigate to `http://localhost:8080`
   - You should see a new GitHub panel on the right side

3. **Sign in to GitHub**
   - Click "Sign in with GitHub" in the GitHub panel
   - You'll be redirected to GitHub for authorization
   - Authorize the AI-IDE application
   - You'll be redirected back to the IDE

4. **Verify the integration**
   - You should see your GitHub repositories listed
   - You can now clone, create, and manage repositories directly from the IDE

## Features Available

### Repository Management
- **View repositories**: See all your GitHub repositories with details
- **Create repositories**: Create new repositories directly from the IDE
- **Delete repositories**: Remove repositories (use with caution)
- **Repository information**: View language, stars, forks, and last updated

### Git Operations
- **Clone repositories**: Clone any repository to your local workspace
- **Branch management**: Create, switch, and delete branches
- **Commit changes**: Stage files and commit with custom messages
- **Push/Pull**: Sync with remote repositories
- **Git status**: View current branch, tracking, and file status

### Authentication
- **OAuth login**: Secure authentication with GitHub
- **Session persistence**: Stay logged in between browser sessions
- **Automatic logout**: Clear credentials when logging out

## Security Notes

- **Client Secret**: Never commit your client secret to version control
- **Local Development**: The callback URL is set to localhost for development
- **Production**: For production use, update the callback URL to your domain
- **Scopes**: The app requests `repo` and `user` scopes for full functionality

## Troubleshooting

### Common Issues

1. **"Invalid client_id" error**
   - Verify your Client ID is correct in `githubService.ts`
   - Make sure there are no extra spaces or characters

2. **"Invalid redirect_uri" error**
   - Ensure the callback URL in GitHub matches exactly: `http://localhost:8080/github/callback`
   - Check for typos in the URL

3. **Authentication fails after redirect**
   - Check the browser console for error messages
   - Verify your Client Secret is correct
   - Ensure the GitHub OAuth App is properly configured

4. **Repositories not loading**
   - Check if you're properly authenticated
   - Verify the GitHub API rate limits
   - Check browser console for API errors

### Debug Mode

To enable debug logging, you can add console.log statements in the GitHub service:

```typescript
console.log('GitHub authentication attempt:', { clientId, redirectUri });
console.log('GitHub API response:', response);
```

## Production Deployment

When deploying to production:

1. **Update OAuth App settings**
   - Change Homepage URL to your production domain
   - Update Authorization callback URL to your production domain

2. **Environment variables**
   - Store Client ID and Secret in environment variables
   - Never hardcode credentials in production code

3. **HTTPS requirement**
   - GitHub requires HTTPS for production OAuth Apps
   - Ensure your production domain has a valid SSL certificate

## API Rate Limits

GitHub has rate limits for API calls:
- **Authenticated users**: 5,000 requests per hour
- **Unauthenticated users**: 60 requests per hour

The IDE will handle rate limiting gracefully and show appropriate error messages.

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your OAuth App configuration
3. Check GitHub's API status page
4. Review the GitHub API documentation

## Additional Resources

- [GitHub OAuth App Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Octokit.js Documentation](https://octokit.github.io/rest.js/)

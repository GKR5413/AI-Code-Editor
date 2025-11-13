import { Octokit } from '@octokit/rest';
import { createOAuthUserAuth } from '@octokit/auth-oauth-user';

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  email: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  updated_at: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
}

class GitHubService {
  private octokit: Octokit | null = null;
  private user: GitHubUser | null = null;

  // GitHub OAuth App configuration
  private readonly CLIENT_ID = 'your_github_client_id'; // You'll need to create this
  private readonly REDIRECT_URI = 'http://localhost:8080/github/callback';

  async authenticate(code: string): Promise<GitHubUser> {
    try {
      const auth = createOAuthUserAuth({
        clientId: this.CLIENT_ID,
        clientSecret: 'your_github_client_secret', // You'll need to create this
        code,
        redirectUri: this.REDIRECT_URI,
      });

      const { token } = await auth({ type: 'oauth-user' });
      
      this.octokit = new Octokit({
        auth: token,
      });

      // Get user information
      const { data: user } = await this.octokit.users.getAuthenticated();
      this.user = {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
        email: user.email || '',
      };

      // Store token in localStorage (in production, use secure storage)
      localStorage.setItem('github_token', token);
      localStorage.setItem('github_user', JSON.stringify(this.user));

      return this.user;
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      throw new Error('Failed to authenticate with GitHub');
    }
  }

  async restoreSession(): Promise<GitHubUser | null> {
    try {
      const token = localStorage.getItem('github_token');
      const userStr = localStorage.getItem('github_user');

      if (!token || !userStr) {
        return null;
      }

      this.octokit = new Octokit({ auth: token });
      this.user = JSON.parse(userStr);

      // Verify token is still valid
      await this.octokit.users.getAuthenticated();
      return this.user;
    } catch (error) {
      console.error('Failed to restore GitHub session:', error);
      this.logout();
      return null;
    }
  }

  logout(): void {
    this.octokit = null;
    this.user = null;
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
  }

  isAuthenticated(): boolean {
    return this.octokit !== null && this.user !== null;
  }

  getUser(): GitHubUser | null {
    return this.user;
  }

  async getRepositories(): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      });

      return repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        language: repo.language || '',
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
      }));
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      throw new Error('Failed to fetch repositories');
    }
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: repoData } = await this.octokit.repos.get({ owner, repo });
      
      return {
        id: repoData.id,
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description || '',
        private: repoData.private,
        html_url: repoData.html_url,
        clone_url: repoData.clone_url,
        ssh_url: repoData.ssh_url,
        default_branch: repoData.default_branch,
        updated_at: repoData.updated_at,
        language: repoData.language || '',
        stargazers_count: repoData.stargazers_count,
        forks_count: repoData.forks_count,
      };
    } catch (error) {
      console.error('Failed to fetch repository:', error);
      throw new Error('Failed to fetch repository');
    }
  }

  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: branches } = await this.octokit.repos.listBranches({ owner, repo });
      
      return branches.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
        protected: branch.protected || false,
      }));
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      throw new Error('Failed to fetch branches');
    }
  }

  async getCommits(owner: string, repo: string, branch: string = 'main'): Promise<GitHubCommit[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: commits } = await this.octokit.repos.listCommits({ owner, repo, sha: branch });
      
      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || '',
          email: commit.commit.author?.email || '',
          date: commit.commit.author?.date || '',
        },
        committer: {
          name: commit.commit.committer?.name || '',
          email: commit.commit.committer?.email || '',
          date: commit.commit.committer?.date || '',
        },
      }));
    } catch (error) {
      console.error('Failed to fetch commits:', error);
      throw new Error('Failed to fetch commits');
    }
  }

  async createRepository(name: string, description: string, isPrivate: boolean = false): Promise<GitHubRepository> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      });

      return {
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        language: repo.language || '',
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
      };
    } catch (error) {
      console.error('Failed to create repository:', error);
      throw new Error('Failed to create repository');
    }
  }

  async deleteRepository(owner: string, repo: string): Promise<void> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      await this.octokit.repos.delete({ owner, repo });
    } catch (error) {
      console.error('Failed to delete repository:', error);
      throw new Error('Failed to delete repository');
    }
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      scope: 'repo user',
      state: Math.random().toString(36).substring(7),
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
}

export const githubService = new GitHubService();

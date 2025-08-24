import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';

export interface GitStatus {
  current: string;
  tracking: string;
  ahead: number;
  behind: number;
  files: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
  };
}

export interface GitLog {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  tracking?: string;
  ahead?: number;
  behind?: number;
}

class GitService {
  private git: SimpleGit | null = null;
  private currentPath: string = '';

  async initialize(path: string): Promise<void> {
    try {
      const options: Partial<SimpleGitOptions> = {
        baseDir: path,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
      };

      this.git = simpleGit(options);
      this.currentPath = path;

      // Check if this is a git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a git repository');
      }
    } catch (error) {
      console.error('Failed to initialize git service:', error);
      throw new Error('Failed to initialize git service');
    }
  }

  async clone(url: string, path: string): Promise<void> {
    try {
      const options: Partial<SimpleGitOptions> = {
        baseDir: path,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
      };

      const git = simpleGit(options);
      await git.clone(url, path);
      
      // Re-initialize with the cloned repository
      await this.initialize(path);
    } catch (error) {
      console.error('Failed to clone repository:', error);
      throw new Error('Failed to clone repository');
    }
  }

  async init(path: string): Promise<void> {
    try {
      const options: Partial<SimpleGitOptions> = {
        baseDir: path,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
      };

      const git = simpleGit(options);
      await git.init();
      
      // Re-initialize with the new repository
      await this.initialize(path);
    } catch (error) {
      console.error('Failed to initialize git repository:', error);
      throw new Error('Failed to initialize git repository');
    }
  }

  async getStatus(): Promise<GitStatus> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      const status = await this.git.status();
      
      return {
        current: status.current || '',
        tracking: status.tracking || '',
        ahead: status.ahead || 0,
        behind: status.behind || 0,
        files: {
          staged: status.staged || [],
          unstaged: status.modified || [],
          untracked: status.not_added || [],
        },
      };
    } catch (error) {
      console.error('Failed to get git status:', error);
      throw new Error('Failed to get git status');
    }
  }

  async getLog(count: number = 50): Promise<GitLog[]> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      const log = await this.git.log({ maxCount: count });
      
      return log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author_name: commit.author_name,
        author_email: commit.author_email,
      }));
    } catch (error) {
      console.error('Failed to get git log:', error);
      throw new Error('Failed to get git log');
    }
  }

  async getBranches(): Promise<GitBranch[]> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      const branches = await this.git.branch();
      
      return Object.keys(branches.branches).map(name => {
        const branch = branches.branches[name];
        return {
          name: branch.name,
          current: branch.current || false,
          tracking: branch.tracking || undefined,
          ahead: branch.ahead || undefined,
          behind: branch.behind || undefined,
        };
      });
    } catch (error) {
      console.error('Failed to get git branches:', error);
      throw new Error('Failed to get git branches');
    }
  }

  async checkout(branch: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      await this.git.checkout(branch);
    } catch (error) {
      console.error('Failed to checkout branch:', error);
      throw new Error('Failed to checkout branch');
    }
  }

  async createBranch(name: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      await this.git.checkoutLocalBranch(name);
    } catch (error) {
      console.error('Failed to create branch:', error);
      throw new Error('Failed to create branch');
    }
  }

  async deleteBranch(name: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      await this.git.deleteLocalBranch(name);
    } catch (error) {
      console.error('Failed to delete branch:', error);
      throw new Error('Failed to delete branch');
    }
  }

  async add(files: string[]): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      if (files.length === 0) {
        await this.git.add('.');
      } else {
        await this.git.add(files);
      }
    } catch (error) {
      console.error('Failed to add files:', error);
      throw new Error('Failed to add files');
    }
  }

  async commit(message: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      await this.git.commit(message);
    } catch (error) {
      console.error('Failed to commit:', error);
      throw new Error('Failed to commit');
    }
  }

  async push(remote: string = 'origin', branch?: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      if (branch) {
        await this.git.push(remote, branch);
      } else {
        await this.git.push(remote);
      }
    } catch (error) {
      console.error('Failed to push:', error);
      throw new Error('Failed to push');
    }
  }

  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      if (branch) {
        await this.git.pull(remote, branch);
      } else {
        await this.git.pull(remote);
      }
    } catch (error) {
      console.error('Failed to pull:', error);
      throw new Error('Failed to pull');
    }
  }

  async fetch(remote: string = 'origin'): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      await this.git.fetch(remote);
    } catch (error) {
      console.error('Failed to fetch:', error);
      throw new Error('Failed to fetch');
    }
  }

  async addRemote(name: string, url: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      await this.git.addRemote(name, url);
    } catch (error) {
      console.error('Failed to add remote:', error);
      throw new Error('Failed to add remote');
    }
  }

  async getRemotes(): Promise<{ name: string; url: string }[]> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      const remotes = await this.git.getRemotes(true);
      return remotes.map(remote => ({
        name: remote.name,
        url: remote.refs.fetch || remote.refs.push || '',
      }));
    } catch (error) {
      console.error('Failed to get remotes:', error);
      throw new Error('Failed to get remotes');
    }
  }

  async reset(type: 'soft' | 'mixed' | 'hard' = 'mixed', commit?: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      if (commit) {
        await this.git.reset([type, commit]);
      } else {
        await this.git.reset([type]);
      }
    } catch (error) {
      console.error('Failed to reset:', error);
      throw new Error('Failed to reset');
    }
  }

  async stash(message?: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      if (message) {
        await this.git.stash(['push', '-m', message]);
      } else {
        await this.git.stash();
      }
    } catch (error) {
      console.error('Failed to stash:', error);
      throw new Error('Failed to stash');
    }
  }

  async stashPop(): Promise<void> {
    if (!this.git) {
      throw new Error('Git service not initialized');
    }

    try {
      await this.git.stash(['pop']);
    } catch (error) {
      console.error('Failed to pop stash:', error);
      throw new Error('Failed to pop stash');
    }
  }

  getCurrentPath(): string {
    return this.currentPath;
  }

  isInitialized(): boolean {
    return this.git !== null;
  }
}

export const gitService = new GitService();

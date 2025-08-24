import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { githubService, GitHubUser, GitHubRepository } from '@/services/githubService';
import { gitService, GitStatus, GitLog, GitBranch } from '@/services/gitService';
import { useToast } from '@/hooks/use-toast';

interface GitHubContextType {
  // Authentication
  user: GitHubUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  handleCallback: (code: string) => Promise<void>;
  
  // Repositories
  repositories: GitHubRepository[];
  currentRepository: GitHubRepository | null;
  setCurrentRepository: (repo: GitHubRepository | null) => void;
  refreshRepositories: () => Promise<void>;
  createRepository: (name: string, description: string, isPrivate: boolean) => Promise<void>;
  deleteRepository: (owner: string, repo: string) => Promise<void>;
  
  // Git Operations
  gitStatus: GitStatus | null;
  gitLog: GitLog[];
  gitBranches: GitBranch[];
  currentBranch: string;
  
  // Git Actions
  cloneRepository: (url: string, path: string) => Promise<void>;
  initRepository: (path: string) => Promise<void>;
  checkoutBranch: (branch: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;
  addFiles: (files: string[]) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  pushChanges: (remote?: string, branch?: string) => Promise<void>;
  pullChanges: (remote?: string, branch?: string) => Promise<void>;
  fetchChanges: (remote?: string) => Promise<void>;
  
  // Refresh Git Data
  refreshGitStatus: () => Promise<void>;
  refreshGitLog: () => Promise<void>;
  refreshGitBranches: () => Promise<void>;
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined);

export const useGitHub = () => {
  const context = useContext(GitHubContext);
  if (context === undefined) {
    throw new Error('useGitHub must be used within a GitHubProvider');
  }
  return context;
};

interface GitHubProviderProps {
  children: ReactNode;
}

export const GitHubProvider: React.FC<GitHubProviderProps> = ({ children }) => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [currentRepository, setCurrentRepository] = useState<GitHubRepository | null>(null);
  
  // Git state
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLog, setGitLog] = useState<GitLog[]>([]);
  const [gitBranches, setGitBranches] = useState<GitBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  
  const { toast } = useToast();

  // Initialize GitHub session on mount
  useEffect(() => {
    const initGitHub = async () => {
      try {
        const restoredUser = await githubService.restoreSession();
        if (restoredUser) {
          setUser(restoredUser);
          setIsAuthenticated(true);
          await refreshRepositories();
        }
      } catch (error) {
        console.error('Failed to restore GitHub session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initGitHub();
  }, []);

  // Initialize Git service when current repository changes
  useEffect(() => {
    if (currentRepository && isAuthenticated) {
      const initGit = async () => {
        try {
          // This would need to be integrated with your file system service
          // For now, we'll assume the repository is cloned to a local path
          const localPath = `/workspace/${currentRepository.name}`;
          await gitService.initialize(localPath);
          await refreshGitData();
        } catch (error) {
          console.error('Failed to initialize git service:', error);
        }
      };

      initGit();
    }
  }, [currentRepository, isAuthenticated]);

  const login = () => {
    const authUrl = githubService.getAuthUrl();
    window.location.href = authUrl;
  };

  const logout = () => {
    githubService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setRepositories([]);
    setCurrentRepository(null);
    setGitStatus(null);
    setGitLog([]);
    setGitBranches([]);
    setCurrentBranch('');
    toast({
      title: "Logged out",
      description: "Successfully logged out of GitHub",
    });
  };

  const handleCallback = async (code: string) => {
    try {
      setIsLoading(true);
      const authenticatedUser = await githubService.authenticate(code);
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      await refreshRepositories();
      toast({
        title: "Success",
        description: `Welcome back, ${authenticatedUser.name}!`,
      });
    } catch (error) {
      console.error('Authentication callback failed:', error);
      toast({
        title: "Authentication failed",
        description: "Failed to authenticate with GitHub",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRepositories = async () => {
    try {
      const repos = await githubService.getRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to refresh repositories:', error);
      toast({
        title: "Error",
        description: "Failed to fetch repositories",
        variant: "destructive",
      });
    }
  };

  const createRepository = async (name: string, description: string, isPrivate: boolean) => {
    try {
      const newRepo = await githubService.createRepository(name, description, isPrivate);
      setRepositories(prev => [newRepo, ...prev]);
      toast({
        title: "Repository created",
        description: `Successfully created ${name}`,
      });
    } catch (error) {
      console.error('Failed to create repository:', error);
      toast({
        title: "Error",
        description: "Failed to create repository",
        variant: "destructive",
      });
    }
  };

  const deleteRepository = async (owner: string, repo: string) => {
    try {
      await githubService.deleteRepository(owner, repo);
      setRepositories(prev => prev.filter(r => r.full_name !== `${owner}/${repo}`));
      if (currentRepository?.full_name === `${owner}/${repo}`) {
        setCurrentRepository(null);
      }
      toast({
        title: "Repository deleted",
        description: `Successfully deleted ${repo}`,
      });
    } catch (error) {
      console.error('Failed to delete repository:', error);
      toast({
        title: "Error",
        description: "Failed to delete repository",
        variant: "destructive",
      });
    }
  };

  const refreshGitData = async () => {
    if (!gitService.isInitialized()) return;
    
    try {
      await Promise.all([
        refreshGitStatus(),
        refreshGitLog(),
        refreshGitBranches(),
      ]);
    } catch (error) {
      console.error('Failed to refresh git data:', error);
    }
  };

  const refreshGitStatus = async () => {
    try {
      const status = await gitService.getStatus();
      setGitStatus(status);
      setCurrentBranch(status.current);
    } catch (error) {
      console.error('Failed to refresh git status:', error);
    }
  };

  const refreshGitLog = async () => {
    try {
      const log = await gitService.getLog();
      setGitLog(log);
    } catch (error) {
      console.error('Failed to refresh git log:', error);
    }
  };

  const refreshGitBranches = async () => {
    try {
      const branches = await gitService.getBranches();
      setGitBranches(branches);
    } catch (error) {
      console.error('Failed to refresh git branches:', error);
    }
  };

  const cloneRepository = async (url: string, path: string) => {
    try {
      await gitService.clone(url, path);
      toast({
        title: "Repository cloned",
        description: "Successfully cloned repository",
      });
    } catch (error) {
      console.error('Failed to clone repository:', error);
      toast({
        title: "Error",
        description: "Failed to clone repository",
        variant: "destructive",
      });
    }
  };

  const initRepository = async (path: string) => {
    try {
      await gitService.init(path);
      toast({
        title: "Repository initialized",
        description: "Successfully initialized git repository",
      });
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      toast({
        title: "Error",
        description: "Failed to initialize repository",
        variant: "destructive",
      });
    }
  };

  const checkoutBranch = async (branch: string) => {
    try {
      await gitService.checkout(branch);
      await refreshGitData();
      toast({
        title: "Branch checked out",
        description: `Switched to ${branch}`,
      });
    } catch (error) {
      console.error('Failed to checkout branch:', error);
      toast({
        title: "Error",
        description: "Failed to checkout branch",
        variant: "destructive",
      });
    }
  };

  const createBranch = async (name: string) => {
    try {
      await gitService.createBranch(name);
      await refreshGitData();
      toast({
        title: "Branch created",
        description: `Successfully created ${name}`,
      });
    } catch (error) {
      console.error('Failed to create branch:', error);
      toast({
        title: "Error",
        description: "Failed to create branch",
        variant: "destructive",
      });
    }
  };

  const deleteBranch = async (name: string) => {
    try {
      await gitService.deleteBranch(name);
      await refreshGitData();
      toast({
        title: "Branch deleted",
        description: `Successfully deleted ${name}`,
      });
    } catch (error) {
      console.error('Failed to delete branch:', error);
      toast({
        title: "Error",
        description: "Failed to delete branch",
        variant: "destructive",
      });
    }
  };

  const addFiles = async (files: string[]) => {
    try {
      await gitService.add(files);
      await refreshGitStatus();
      toast({
        title: "Files staged",
        description: "Successfully staged files",
      });
    } catch (error) {
      console.error('Failed to add files:', error);
      toast({
        title: "Error",
        description: "Failed to stage files",
        variant: "destructive",
      });
    }
  };

  const commitChanges = async (message: string) => {
    try {
      await gitService.commit(message);
      await refreshGitData();
      toast({
        title: "Changes committed",
        description: "Successfully committed changes",
      });
    } catch (error) {
      console.error('Failed to commit changes:', error);
      toast({
        title: "Error",
        description: "Failed to commit changes",
        variant: "destructive",
      });
    }
  };

  const pushChanges = async (remote: string = 'origin', branch?: string) => {
    try {
      await gitService.push(remote, branch);
      await refreshGitStatus();
      toast({
        title: "Changes pushed",
        description: "Successfully pushed changes",
      });
    } catch (error) {
      console.error('Failed to push changes:', error);
      toast({
        title: "Error",
        description: "Failed to push changes",
        variant: "destructive",
      });
    }
  };

  const pullChanges = async (remote: string = 'origin', branch?: string) => {
    try {
      await gitService.pull(remote, branch);
      await refreshGitData();
      toast({
        title: "Changes pulled",
        description: "Successfully pulled changes",
      });
    } catch (error) {
      console.error('Failed to pull changes:', error);
      toast({
        title: "Error",
        description: "Failed to pull changes",
        variant: "destructive",
      });
    }
  };

  const fetchChanges = async (remote: string = 'origin') => {
    try {
      await gitService.fetch(remote);
      await refreshGitStatus();
      toast({
        title: "Changes fetched",
        description: "Successfully fetched changes",
      });
    } catch (error) {
      console.error('Failed to fetch changes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch changes",
        variant: "destructive",
      });
    }
  };

  const value: GitHubContextType = {
    // Authentication
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    handleCallback,
    
    // Repositories
    repositories,
    currentRepository,
    setCurrentRepository,
    refreshRepositories,
    createRepository,
    deleteRepository,
    
    // Git Operations
    gitStatus,
    gitLog,
    gitBranches,
    currentBranch,
    
    // Git Actions
    cloneRepository,
    initRepository,
    checkoutBranch,
    createBranch,
    deleteBranch,
    addFiles,
    commitChanges,
    pushChanges,
    pullChanges,
    fetchChanges,
    
    // Refresh Git Data
    refreshGitStatus,
    refreshGitLog,
    refreshGitBranches,
  };

  return (
    <GitHubContext.Provider value={value}>
      {children}
    </GitHubContext.Provider>
  );
};

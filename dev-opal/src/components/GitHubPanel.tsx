import React, { useState } from 'react';
import { useGitHub } from '@/contexts/GitHubContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Github, 
  GitBranch, 
  GitCommit, 
  GitPullRequest, 
  GitPush, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload,
  User,
  Lock,
  Globe,
  Calendar,
  Star,
  GitFork,
  Code,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

export default function GitHubPanel() {
  const {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    repositories,
    currentRepository,
    setCurrentRepository,
    refreshRepositories,
    createRepository,
    deleteRepository,
    gitStatus,
    gitLog,
    gitBranches,
    currentBranch,
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
    refreshGitStatus,
    refreshGitLog,
    refreshGitBranches,
  } = useGitHub();

  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [newRepoIsPrivate, setNewRepoIsPrivate] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [clonePath, setClonePath] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-center space-y-4">
          <Github className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-2xl font-bold">Connect to GitHub</h2>
            <p className="text-muted-foreground">
              Sign in to access your repositories and manage your code
            </p>
          </div>
          <Button onClick={login} className="w-full" size="lg">
            <Github className="h-4 w-4 mr-2" />
            Sign in with GitHub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-ide-panel-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Github className="h-5 w-5" />
            <div>
              <h2 className="font-semibold">GitHub</h2>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{user?.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {repositories.length} repos
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshRepositories}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="repositories" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="git">Git</TabsTrigger>
          <TabsTrigger value="clone">Clone</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="repositories" className="flex-1 p-4 space-y-4">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {repositories.map((repo) => (
                <Card
                  key={repo.id}
                  className={`cursor-pointer transition-colors ${
                    currentRepository?.id === repo.id
                      ? 'ring-2 ring-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setCurrentRepository(repo)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        {repo.private ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-sm">{repo.name}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRepository(user?.login || '', repo.name);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      {repo.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                          <Code className="h-3 w-3" />
                          <span>{repo.language || 'Unknown'}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Star className="h-3 w-3" />
                          <span>{repo.stargazers_count}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <GitFork className="h-3 w-3" />
                          <span>{repo.forks_count}</span>
                        </span>
                      </div>
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(repo.updated_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="git" className="flex-1 p-4 space-y-4">
          {!currentRepository ? (
            <div className="text-center text-muted-foreground py-8">
              Select a repository to view Git operations
            </div>
          ) : (
            <div className="space-y-4">
              {/* Repository Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <GitBranch className="h-4 w-4" />
                    <span>{currentRepository.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {currentBranch || 'main'}
                    </Badge>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshGitStatus}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchChanges()}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Git Status */}
              {gitStatus && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Current Branch:</span>
                      <span className="font-mono">{gitStatus.current}</span>
                    </div>
                    {gitStatus.tracking && (
                      <div className="flex items-center justify-between text-xs">
                        <span>Tracking:</span>
                        <span className="font-mono">{gitStatus.tracking}</span>
                      </div>
                    )}
                    {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                      <div className="flex items-center justify-between text-xs">
                        <span>Remote:</span>
                        <span className="font-mono">
                          {gitStatus.ahead > 0 && `+${gitStatus.ahead}`}
                          {gitStatus.behind > 0 && `-${gitStatus.behind}`}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Git Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pullChanges()}
                      disabled={!gitStatus?.tracking}
                    >
                      <GitPullRequest className="h-3 w-3 mr-1" />
                      Pull
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pushChanges()}
                      disabled={!gitStatus?.tracking}
                    >
                      <GitPush className="h-3 w-3 mr-1" />
                      Push
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Commit Changes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Commit Changes</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Textarea
                    placeholder="Commit message..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFiles([])}
                      disabled={!gitStatus?.files.unstaged.length && !gitStatus?.files.untracked.length}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Stage All
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        commitChanges(commitMessage);
                        setCommitMessage('');
                      }}
                      disabled={!commitMessage.trim()}
                    >
                      <GitCommit className="h-3 w-3 mr-1" />
                      Commit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Branches */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Branches</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="New branch name"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        createBranch(newBranchName);
                        setNewBranchName('');
                      }}
                      disabled={!newBranchName.trim()}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {gitBranches.map((branch) => (
                        <div
                          key={branch.name}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                        >
                          <div className="flex items-center space-x-2">
                            {branch.current && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                            <span className="text-sm font-mono">{branch.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {branch.tracking && (
                              <Badge variant="secondary" className="text-xs">
                                {branch.ahead && branch.ahead > 0 && `+${branch.ahead}`}
                                {branch.behind && branch.behind > 0 && `-${branch.behind}`}
                              </Badge>
                            )}
                            {!branch.current && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => checkoutBranch(branch.name)}
                              >
                                <GitBranch className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="clone" className="flex-1 p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Clone Repository</CardTitle>
              <CardDescription>
                Clone a repository from GitHub to your local workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Repository URL</label>
                <Input
                  placeholder="https://github.com/username/repository.git"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Local Path</label>
                <Input
                  placeholder="/workspace/repository-name"
                  value={clonePath}
                  onChange={(e) => setClonePath(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  cloneRepository(cloneUrl, clonePath);
                  setCloneUrl('');
                  setClonePath('');
                }}
                disabled={!cloneUrl.trim() || !clonePath.trim()}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Clone Repository
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="flex-1 p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Create Repository</CardTitle>
              <CardDescription>
                Create a new repository on GitHub
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Repository Name</label>
                <Input
                  placeholder="my-awesome-project"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="A brief description of your project..."
                  value={newRepoDescription}
                  onChange={(e) => setNewRepoDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="private"
                  checked={newRepoIsPrivate}
                  onChange={(e) => setNewRepoIsPrivate(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="private" className="text-sm">
                  Make this repository private
                </label>
              </div>
              <Button
                onClick={() => {
                  createRepository(newRepoName, newRepoDescription, newRepoIsPrivate);
                  setNewRepoName('');
                  setNewRepoDescription('');
                  setNewRepoIsPrivate(false);
                }}
                disabled={!newRepoName.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Repository
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

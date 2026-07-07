import { createMDX } from 'fumadocs-mdx/next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const githubRepositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'A3S';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',
  basePath: isGitHubPages ? `/${githubRepositoryName}` : '',
  images: { unoptimized: true },
};

const withMDX = createMDX();
export default withMDX(config);

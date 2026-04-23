# Bristlecone Frontend

The frontend of Bristlecone AI Platform is built with Next.js, TypeScript, and Tailwind CSS, providing a modern and responsive user interface.

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand (via `zustand` library for stores like `useMessagesStore`, `useUserStore`) and custom React hooks.
- **Package Manager**: pnpm

## Project Structure

```
bristlecone-frontend/
├── app/            # Next.js app directory (pages and layouts)
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks (if any, primarily using Zustand for shared state)
├── lib/            # Utility functions, API clients (e.g., axiosInstance), and shared logic
├── public/         # Static assets
├── store/          # Zustand store configurations (e.g., messages.ts, user.ts)
├── styles/         # Global styles and Tailwind configuration
├── .env.local      # Local environment variables (untracked)
├── next.config.mjs # Next.js configuration
├── package.json    # Project dependencies and scripts
├── pnpm-lock.yaml  # Exact versions of dependencies for pnpm
├── tsconfig.json   # TypeScript configuration
└── README.md       # This file
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (https://pnpm.io/installation)

### Installation

1. **Clone the repository (if you haven't already).**

2. **Navigate to the frontend directory:**
   ```bash
   cd final__bristleconefrontend
   ```

3. **Install Dependencies:**
   ```bash
   pnpm install
   ```

4. **Set up Environment Variables:**
   Create a `.env.local` file in the `final__bristleconefrontend` root directory with the following variable. This URL should point to your running Bristlecone backend.
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 # Or your backend's actual port
   ```
   *Note: Ensure your backend is running and accessible at this URL.*

5. **Run Development Server:**
   ```bash
   pnpm run dev
   ```
   The application should now be running on `http://localhost:3000` (or the next available port).

6. **Build for Production:**
   ```bash
   pnpm run build
   ```

## Development

### Key Features

- **Modern UI**: Built with Tailwind CSS for responsive and beautiful interfaces.
- **Type Safety**: Full TypeScript support for a better development experience.
- **Component-Based Architecture**: Reusable components for consistent UI/UX.
- **Efficient State Management**: Centralized state handling using Zustand for `messages` and `user` stores.
- **API Integration**: Seamless integration with the Bristlecone backend via an Axios instance configured with `NEXT_PUBLIC_API_BASE_URL`.

### Directory Structure Details

- **`app/`**: Contains all the pages and layouts using the Next.js 14 App Router.
- **`components/`**: Houses reusable UI components (e.g., `ChatInterface`, `ChatSidebar`, `ChatMessage`).
- **`hooks/`**: Intended for custom React hooks, though complex state is primarily managed by Zustand stores.
- **`lib/`**: Contains utility functions (`utils.ts`), the configured Axios instance (`axiosInstance.ts`), API interaction logic (`api.ts`), and type definitions (`types.ts`).
- **`public/`**: For static assets like images, fonts, etc.
- **`store/`**: Zustand store configurations, notably `messages.ts` for chat messages and state, and `user.ts` for user authentication and data.
- **`styles/`**: Global styles and Tailwind CSS configuration files.

### Best Practices

1.  **Component Organization**
    *   Keep components focused on a single responsibility.
    *   Use TypeScript interfaces for all component props.
2.  **State Management (Zustand)**
    *   Define actions within your stores for state modifications.
    *   Use selectors to access specific pieces of state efficiently.
    *   Keep global state relevant to shared concerns (e.g., user session, messages).
3.  **Styling**
    *   Primarily use Tailwind CSS utility classes.
    *   Follow consistent design patterns for UI elements.
4.  **TypeScript**
    *   Leverage strong typing for all data structures and functions.
    *   Avoid using `any` where specific types can be defined.
5.  **API Calls**
    *   Centralize API call logic (e.g., in `lib/api.ts` or directly in store actions).
    *   Handle API errors gracefully and provide user feedback.

## Contributing

1.  Follow the existing code style and project patterns.
2.  Write clear and meaningful commit messages.
3.  Update documentation (like this README) if your changes affect setup, architecture, or usage.
4.  Ensure your changes are well-tested.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details (if one exists, otherwise assume proprietary or specify). 
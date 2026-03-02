"use client";

import {
	Component,
	type ErrorInfo,
	type PropsWithChildren,
	type ReactNode,
} from "react";

type State = {
	hasError: boolean;
	error: Error | null;
};

// Class component required by React for error boundary lifecycle methods.
// This is the one exception to the project's "const arrow functions" convention.
export class ErrorBoundary extends Component<PropsWithChildren, State> {
	state: State = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	handleReset = (): void => {
		try {
			localStorage.removeItem("prodfactory-save");
		} catch {
			// localStorage may be unavailable
		}
		window.location.reload();
	};

	handleRetry = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): ReactNode {
		if (!this.state.hasError) {
			return this.props.children;
		}

		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<div className="max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-lg">
					<h1 className="mb-2 text-xl font-bold text-text-primary">
						Something went wrong
					</h1>
					<p className="mb-6 text-sm text-text-secondary">
						An unexpected error occurred. You can try again or reset your game
						to start fresh.
					</p>
					{this.state.error && (
						<pre className="mb-6 max-h-24 overflow-auto rounded bg-background p-2 text-left text-xs text-text-secondary">
							{this.state.error.message}
						</pre>
					)}
					<div className="flex justify-center gap-3">
						<button
							type="button"
							onClick={this.handleRetry}
							className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							Try Again
						</button>
						<button
							type="button"
							onClick={this.handleReset}
							className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-600/10"
						>
							Reset Game
						</button>
					</div>
				</div>
			</div>
		);
	}
}

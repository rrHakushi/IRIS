import type { BuilderTemplate } from "./types"

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: "dynamic-grid",
    name: "Dynamic 12-Column Canvas",
    description: "Place widgets freely on the left, center, right, or across the full screen",
    icon: "IconLayoutGrid",
    schema: {
      title: "Dynamic 12-Column Canvas",
      state: {
        noteText: "Custom note placed on the right sidebar panel",
        metricOne: 94,
        metricTwo: 78,
      },
      actions: {
        refreshCanvas: "set('metricOne', Math.floor(Math.random() * 20) + 80); toast.success('Refreshed canvas widgets');",
      },
      root: {
        type: "div",
        props: { className: "w-full p-6 md:p-8 space-y-8" },
        children: [
          {
            type: "div",
            props: { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5" },
            children: [
              {
                type: "div",
                children: [
                  { type: "h1", props: { className: "text-2xl font-bold font-heading tracking-tight" }, children: "Freeform Dynamic Canvas" },
                  { type: "p", props: { className: "text-xs text-muted-foreground" }, children: "Responsive 12-column grid layout allowing widgets anywhere on screen" },
                ],
              },
              {
                type: "div",
                props: { className: "flex items-center gap-2" },
                children: [
                  {
                    type: "Button",
                    props: {
                      size: "sm",
                      variant: "outline",
                      onPress: "actions.refreshCanvas()",
                    },
                    children: [
                      { type: "Icon", props: { name: "IconRefresh", className: "size-3.5 me-1.5" } },
                      "Refresh Data",
                    ],
                  },
                  {
                    type: "Badge",
                    props: { variant: "default" },
                    children: "12-Col Responsive",
                  },
                ],
              },
            ],
          },
          {
            type: "div",
            props: { className: "grid grid-cols-12 gap-6 w-full items-start" },
            children: [
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-3 space-y-4" },
                children: [
                  {
                    type: "Card",
                    children: [
                      {
                        type: "CardHeader",
                        children: [
                          { type: "CardTitle", children: "Left Widget (Col 1-3)" },
                          { type: "CardDescription", children: "Dedicated left-rail sidebar" },
                        ],
                      },
                      {
                        type: "CardContent",
                        props: { className: "space-y-3" },
                        children: [
                          {
                            type: "div",
                            props: { className: "flex items-center gap-3 p-3 rounded-xl bg-muted/40 border" },
                            children: [
                              {
                                type: "Avatar",
                                props: { size: "md" },
                                children: [
                                  { type: "AvatarFallback", children: "LW" },
                                ],
                              },
                              {
                                type: "div",
                                props: { className: "min-w-0 flex-1" },
                                children: [
                                  { type: "div", props: { className: "font-semibold text-xs truncate" }, children: "Left Rail Dock" },
                                  { type: "div", props: { className: "text-[11px] text-muted-foreground" }, children: "Fixed column span" },
                                ],
                              },
                            ],
                          },
                          {
                            type: "Button",
                            props: {
                              size: "xs",
                              variant: "outline",
                              className: "w-full justify-center text-xs",
                              onPress: "toast.info('Left rail action triggered')",
                            },
                            children: "Left Rail Action",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-6 space-y-6" },
                children: [
                  {
                    type: "Card",
                    children: [
                      {
                        type: "CardHeader",
                        children: [
                          { type: "CardTitle", children: "Center Canvas (Col 4-9)" },
                          { type: "CardDescription", children: "Expansive primary workspace spanning 6 columns" },
                        ],
                      },
                      {
                        type: "CardContent",
                        props: { className: "space-y-4" },
                        children: [
                          {
                            type: "p",
                            props: { className: "text-xs text-muted-foreground leading-relaxed" },
                            children: "This central workspace takes up the middle of the screen. You can expand it to 8 or 10 columns, place elements at any offset, or dock widgets along either boundary.",
                          },
                          {
                            type: "div",
                            props: { className: "grid grid-cols-2 gap-4" },
                            children: [
                              {
                                type: "div",
                                props: { className: "p-4 rounded-2xl bg-muted/30 border space-y-1" },
                                children: [
                                  { type: "div", props: { className: "text-[11px] text-muted-foreground" }, children: "Cluster Health" },
                                  { type: "div", props: { className: "text-2xl font-bold font-heading" }, children: "{{ state.metricOne }}%" },
                                  { type: "Progress", props: { value: "{{ state.metricOne }}", "aria-label": "Health" } },
                                ],
                              },
                              {
                                type: "div",
                                props: { className: "p-4 rounded-2xl bg-muted/30 border space-y-1" },
                                children: [
                                  { type: "div", props: { className: "text-[11px] text-muted-foreground" }, children: "Throughput" },
                                  { type: "div", props: { className: "text-2xl font-bold font-heading" }, children: "{{ state.metricTwo }}%" },
                                  { type: "Progress", props: { value: "{{ state.metricTwo }}", "aria-label": "Throughput" } },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-3 space-y-4" },
                children: [
                  {
                    type: "Card",
                    children: [
                      {
                        type: "CardHeader",
                        children: [
                          { type: "CardTitle", children: "Right Panel (Col 10-12)" },
                          { type: "CardDescription", children: "Far-right inspector & notes" },
                        ],
                      },
                      {
                        type: "CardContent",
                        props: { className: "space-y-3" },
                        children: [
                          {
                            type: "Field",
                            children: [
                              { type: "FieldLabel", children: "Quick Note" },
                              {
                                type: "Textarea",
                                props: {
                                  bind: "state.noteText",
                                  placeholder: "Type notes here...",
                                  className: "h-20 text-xs",
                                },
                              },
                            ],
                          },
                          {
                            type: "Button",
                            props: {
                              size: "xs",
                              variant: "default",
                              className: "w-full justify-center text-xs",
                              onPress: "toast.success('Note saved in right inspector')",
                            },
                            children: "Save Note",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "div",
            props: { className: "w-full p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-4" },
            children: [
              {
                type: "div",
                props: { className: "flex items-center gap-3" },
                children: [
                  { type: "Icon", props: { name: "IconLayoutGrid", className: "size-5 text-primary shrink-0" } },
                  {
                    type: "div",
                    children: [
                      { type: "div", props: { className: "text-xs font-semibold text-foreground" }, children: "Full Bleed Bottom Section" },
                      { type: "div", props: { className: "text-[11px] text-muted-foreground" }, children: "Sections span 100% of available viewport width without horizontal clamping" },
                    ],
                  },
                ],
              },
              {
                type: "Button",
                props: {
                  size: "xs",
                  variant: "outline",
                  onPress: "toast.info('Full-bleed action clicked')",
                },
                children: "Explore Layouts",
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "user-session",
    name: "User & Session Inspector",
    description: "Inspect active user profile, auth session, and permissions via hooks",
    icon: "IconUserCheck",
    schema: {
      title: "User & Session Inspector",
      state: {},
      actions: {
        inspectToken: "toast.info('Active Account: ' + (user ? (user.displayName || user.username || user.email) : 'Guest session'))",
      },
      root: {
        type: "div",
        props: { className: "w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8" },
        children: [
          {
            type: "div",
            props: { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5" },
            children: [
              {
                type: "div",
                children: [
                  { type: "h1", props: { className: "text-2xl font-bold font-heading tracking-tight" }, children: "Host Authentication State" },
                  { type: "p", props: { className: "text-xs text-muted-foreground" }, children: "Bound directly to useUser() and useSession() hooks" },
                ],
              },
              {
                type: "Button",
                props: {
                  size: "sm",
                  variant: "outline",
                  onPress: "actions.inspectToken()",
                },
                children: [
                  { type: "Icon", props: { name: "IconFingerprint", className: "size-4 me-1.5 text-primary" } },
                  "Inspect Identity",
                ],
              },
            ],
          },
          {
            type: "div",
            props: { className: "grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start" },
            children: [
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-6 space-y-4" },
                children: [
                  {
                    type: "Card",
                    children: [
                      {
                        type: "CardHeader",
                        children: [
                          { type: "CardTitle", children: "useUser() Context" },
                          { type: "CardDescription", children: "Direct access to reactive user state" },
                        ],
                      },
                      {
                        type: "CardContent",
                        props: { className: "space-y-4" },
                        children: [
                          {
                            type: "div",
                            props: { className: "flex items-center gap-3.5 p-3.5 rounded-2xl bg-muted/30 border" },
                            children: [
                              {
                                type: "Avatar",
                                props: { size: "lg" },
                                children: [
                                  {
                                    type: "AvatarFallback",
                                    props: { className: "font-bold text-sm tracking-wider" },
                                    children: "{{ user ? (user.displayName || user.username || 'U').slice(0, 2).toUpperCase() : 'GS' }}",
                                  },
                                ],
                              },
                              {
                                type: "div",
                                props: { className: "min-w-0 flex-1 space-y-0.5" },
                                children: [
                                  {
                                    type: "div",
                                    props: { className: "font-semibold text-sm truncate text-foreground" },
                                    children: "{{ user ? (user.displayName || user.username || 'Logged In User') : 'Guest Account' }}",
                                  },
                                  {
                                    type: "div",
                                    props: { className: "text-xs text-muted-foreground truncate" },
                                    children: "{{ user ? (user.email || 'No email associated') : 'Not authenticated' }}",
                                  },
                                ],
                              },
                            ],
                          },
                          {
                            type: "div",
                            props: { className: "space-y-2 pt-1" },
                            children: [
                              {
                                type: "div",
                                props: { className: "flex items-center justify-between text-xs py-2 border-t border-border/40" },
                                children: [
                                  { type: "span", props: { className: "text-muted-foreground shrink-0" }, children: "User ID:" },
                                  { type: "code", props: { className: "font-mono bg-muted/60 px-2 py-0.5 rounded text-[11px] truncate max-w-[220px]" }, children: "{{ user ? (user.id || 'N/A') : 'none' }}" },
                                ],
                              },
                              {
                                type: "div",
                                props: { className: "flex items-center justify-between text-xs py-2 border-t border-border/40" },
                                children: [
                                  { type: "span", props: { className: "text-muted-foreground shrink-0" }, children: "Role / Permissions:" },
                                  {
                                    type: "Badge",
                                    props: { variant: "secondary" },
                                    children: "{{ user && user.role ? user.role : 'Member' }}",
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-6 space-y-4" },
                children: [
                  {
                    type: "Card",
                    children: [
                      {
                        type: "CardHeader",
                        children: [
                          { type: "CardTitle", children: "useSession() Context" },
                          { type: "CardDescription", children: "NextAuth session status and metadata" },
                        ],
                      },
                      {
                        type: "CardContent",
                        props: { className: "space-y-4" },
                        children: [
                          {
                            type: "div",
                            props: { className: "space-y-2" },
                            children: [
                              {
                                type: "div",
                                props: { className: "flex items-center justify-between text-xs py-2 border-b border-border/40" },
                                children: [
                                  { type: "span", props: { className: "text-muted-foreground shrink-0" }, children: "Session Status:" },
                                  {
                                    type: "Badge",
                                    props: { variant: "{{ session ? 'default' : 'outline' }}" },
                                    children: "{{ session ? 'Authenticated' : 'Anonymous' }}",
                                  },
                                ],
                              },
                              {
                                type: "div",
                                props: { className: "flex items-center justify-between text-xs py-2 border-b border-border/40" },
                                children: [
                                  { type: "span", props: { className: "text-muted-foreground shrink-0" }, children: "Session Name:" },
                                  { type: "span", props: { className: "font-medium text-foreground truncate max-w-[200px]" }, children: "{{ session && session.user ? session.user.name : 'N/A' }}" },
                                ],
                              },
                              {
                                type: "div",
                                props: { className: "flex items-center justify-between text-xs py-2" },
                                children: [
                                  { type: "span", props: { className: "text-muted-foreground shrink-0" }, children: "Expires:" },
                                  { type: "span", props: { className: "text-xs font-mono text-muted-foreground" }, children: "{{ session && session.expires ? helpers.formatDate(session.expires) : 'Active Session' }}" },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "theme-sidebar",
    name: "Theme & App Shell Controls",
    description: "Manipulate system theme and collapsible navigation sidebar in real-time",
    icon: "IconPalette",
    schema: {
      title: "Theme & App Shell Controls",
      state: {},
      actions: {
        setDark: "theme.setTheme('dark'); toast.success('Switched to Dark mode');",
        setLight: "theme.setTheme('light'); toast.success('Switched to Light mode');",
        setSystem: "theme.setTheme('system'); toast.info('Theme set to System');",
        toggleNav: "sidebar.toggleSidebar(); toast.info('Navigation sidebar toggled');",
      },
      root: {
        type: "div",
        props: { className: "w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8" },
        children: [
          {
            type: "div",
            props: { className: "space-y-1 border-b border-border/40 pb-5" },
            children: [
              { type: "h1", props: { className: "text-2xl font-bold font-heading tracking-tight" }, children: "App Shell Hooks" },
              { type: "p", props: { className: "text-xs text-muted-foreground" }, children: "Live hooks controlling theme and navigation: useTheme() and SidebarNavigationContext" },
            ],
          },
          {
            type: "div",
            props: { className: "grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start" },
            children: [
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-6 space-y-4" },
                children: [
                  {
                    type: "Card",
                    children: [
                      {
                        type: "CardHeader",
                        children: [
                          { type: "CardTitle", children: "Color Theme Control" },
                          { type: "CardDescription", children: "Active: {{ theme.resolvedTheme }} (Mode: {{ theme.theme }})" },
                        ],
                      },
                      {
                        type: "CardContent",
                        props: { className: "space-y-4" },
                        children: [
                          {
                            type: "p",
                            props: { className: "text-xs text-muted-foreground" },
                            children: "Trigger instant client-side theme transitions via theme.setTheme():",
                          },
                          {
                            type: "div",
                            props: { className: "flex items-center gap-2" },
                            children: [
                              {
                                type: "Button",
                                props: {
                                  size: "sm",
                                  variant: "outline",
                                  onPress: "actions.setLight()",
                                },
                                children: [
                                  { type: "Icon", props: { name: "IconSun", className: "size-4 me-1 text-amber-500" } },
                                  "Light",
                                ],
                              },
                              {
                                type: "Button",
                                props: {
                                  size: "sm",
                                  variant: "outline",
                                  onPress: "actions.setDark()",
                                },
                                children: [
                                  { type: "Icon", props: { name: "IconMoon", className: "size-4 me-1 text-indigo-400" } },
                                  "Dark",
                                ],
                              },
                              {
                                type: "Button",
                                props: {
                                  size: "sm",
                                  variant: "outline",
                                  onPress: "actions.setSystem()",
                                },
                                children: [
                                  { type: "Icon", props: { name: "IconDeviceDesktop", className: "size-4 me-1" } },
                                  "System",
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-6 space-y-4" },
                children: [
                  {
                    type: "Card",
                    children: [
                      {
                        type: "CardHeader",
                        children: [
                          { type: "CardTitle", children: "Navigation Sidebar Control" },
                          { type: "CardDescription", children: "State: {{ sidebar.isOpen ? 'Expanded' : 'Collapsed' }}" },
                        ],
                      },
                      {
                        type: "CardContent",
                        props: { className: "space-y-4" },
                        children: [
                          {
                            type: "p",
                            props: { className: "text-xs text-muted-foreground" },
                            children: "Directly expand or collapse the app shell navigation with sidebar.toggleSidebar():",
                          },
                          {
                            type: "Button",
                            props: {
                              size: "sm",
                              variant: "default",
                              onPress: "actions.toggleNav()",
                            },
                            children: [
                              { type: "Icon", props: { name: "IconLayoutSidebar", className: "size-4 me-1.5" } },
                              "Toggle App Sidebar",
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "elysia-api",
    name: "Elysia Backend Scaffolding",
    description: "Fetch live data from Elysia Eden Treaty API endpoints with async handlers",
    icon: "IconServer2",
    schema: {
      title: "Backend Elysia API Scaffolder",
      state: {
        loading: false,
        statusText: "Ready",
        responseData: 'Click "Execute Elysia Query" to call backend API',
      },
      actions: {
        fetchApi: `
          set('loading', true);
          set('statusText', 'Querying backend...');
          try {
            const res = await elysia.auth.me.get();
            set('statusText', '200 OK');
            set('responseData', JSON.stringify(res.data || res, null, 2));
            toast.success('Successfully queried Elysia API endpoint!');
          } catch (err) {
            set('statusText', 'Error');
            set('responseData', err.message || 'API query failed');
            toast.error('API query failed: ' + (err.message || 'Network error'));
          } finally {
            set('loading', false);
          }
        `,
      },
      root: {
        type: "div",
        props: { className: "w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8" },
        children: [
          {
            type: "div",
            props: { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5" },
            children: [
              {
                type: "div",
                children: [
                  { type: "h1", props: { className: "text-2xl font-bold font-heading tracking-tight" }, children: "Elysia Eden Treaty API" },
                  { type: "p", props: { className: "text-xs text-muted-foreground" }, children: "Asynchronous backend querying via sandboxed elysia client" },
                ],
              },
              {
                type: "Button",
                props: {
                  size: "sm",
                  variant: "default",
                  onPress: "actions.fetchApi()",
                  disabled: "{{ state.loading }}",
                },
                children: [
                  { type: "Icon", props: { name: "IconCloudDownload", className: "size-4 me-1.5" } },
                  "{{ state.loading ? 'Calling API...' : 'Execute Elysia Query' }}",
                ],
              },
            ],
          },
          {
            type: "Card",
            children: [
              {
                type: "CardHeader",
                children: [
                  {
                    type: "div",
                    props: { className: "flex items-center justify-between" },
                    children: [
                      { type: "CardTitle", children: "HTTP / WebSocket Client Response" },
                      {
                        type: "Badge",
                        props: { variant: "{{ state.statusText === '200 OK' ? 'default' : 'secondary' }}" },
                        children: "{{ state.statusText }}",
                      },
                    ],
                  },
                  { type: "CardDescription", children: "Endpoint: GET /api/v1/auth/me" },
                ],
              },
              {
                type: "CardContent",
                children: [
                  {
                    type: "pre",
                    props: { className: "p-4 rounded-xl bg-muted/40 font-mono text-xs overflow-auto max-h-80 whitespace-pre border leading-relaxed" },
                    children: "{{ state.responseData }}",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "notifications-hub",
    name: "Notifications Dashboard",
    description: "Read unread counter and broadcast notifications using useNotifications()",
    icon: "IconBell",
    schema: {
      title: "Notifications Center",
      state: {},
      actions: {
        markAllRead: `
          if (notifications && notifications.markAllAsRead) {
            notifications.markAllAsRead();
          }
          toast.success('Marked all notifications as read');
        `,
        testNotification: `
          toast.info('New incoming alert dispatched');
        `,
      },
      root: {
        type: "div",
        props: { className: "w-full max-w-5xl mx-auto p-6 md:p-8 space-y-6" },
        children: [
          {
            type: "Card",
            children: [
              {
                type: "CardHeader",
                children: [
                  {
                    type: "div",
                    props: { className: "flex items-center justify-between" },
                    children: [
                      {
                        type: "div",
                        children: [
                          { type: "CardTitle", children: "Notifications Hub" },
                          { type: "CardDescription", children: "Connected to useNotifications() host hook" },
                        ],
                      },
                      {
                        type: "Badge",
                        props: { variant: "destructive" },
                        children: "{{ notifications ? (notifications.unreadCount || 0) : 0 }} Unread",
                      },
                    ],
                  },
                ],
              },
              {
                type: "CardContent",
                props: { className: "space-y-4" },
                children: [
                  {
                    type: "div",
                    props: { className: "flex items-center gap-2" },
                    children: [
                      {
                        type: "Button",
                        props: {
                          size: "sm",
                          variant: "outline",
                          onPress: "actions.markAllRead()",
                        },
                        children: [
                          { type: "Icon", props: { name: "IconCheck", className: "size-3.5 me-1 text-emerald-500" } },
                          "Mark all as read",
                        ],
                      },
                      {
                        type: "Button",
                        props: {
                          size: "sm",
                          variant: "outline",
                          onPress: "actions.testNotification()",
                        },
                        children: [
                          { type: "Icon", props: { name: "IconBellRinging", className: "size-3.5 me-1 text-primary" } },
                          "Simulate Notification",
                        ],
                      },
                    ],
                  },
                  {
                    type: "Alert",
                    children: [
                      { type: "Icon", props: { name: "IconInfoCircle", className: "size-4" } },
                      { type: "AlertTitle", children: "Reactive Hook Binding" },
                      {
                        type: "AlertDescription",
                        children: "Notifications count and unread items synchronize in real time across the entire IRIS desktop and web shell.",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "dashboard",
    name: "KPI Dashboard",
    description: "Stats cards with progress bars and metrics",
    icon: "IconLayoutDashboard",
    schema: {
      title: "Metrics Dashboard",
      state: {
        serverCpu: 64,
        memoryUsage: 48,
        activeConnections: 128,
      },
      actions: {
        refreshMetrics: "set('serverCpu', Math.floor(Math.random() * 40) + 40); toast.info('Refreshed KPI stats');",
      },
      root: {
        type: "div",
        props: { className: "w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8" },
        children: [
          {
            type: "div",
            props: { className: "flex items-center justify-between border-b border-border/40 pb-5" },
            children: [
              {
                type: "div",
                children: [
                  { type: "h2", props: { className: "font-heading text-xl font-bold" }, children: "System Status" },
                  { type: "p", props: { className: "text-xs text-muted-foreground" }, children: "Realtime metrics for node cluster" },
                ],
              },
              {
                type: "Button",
                props: {
                  size: "sm",
                  variant: "outline",
                  onPress: "actions.refreshMetrics()",
                },
                children: [
                  { type: "Icon", props: { name: "IconRefresh", className: "size-4 me-1.5" } },
                  "Refresh Stats",
                ],
              },
            ],
          },
          {
            type: "div",
            props: { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
            children: [
              {
                type: "Card",
                children: [
                  {
                    type: "CardHeader",
                    children: [
                      { type: "CardDescription", children: "CPU Utilization" },
                      { type: "CardTitle", props: { className: "text-2xl font-bold" }, children: "{{ state.serverCpu }}%" },
                    ],
                  },
                  {
                    type: "CardContent",
                    children: [
                      {
                        type: "Progress",
                        props: { value: "{{ state.serverCpu }}", "aria-label": "CPU Load" },
                      },
                    ],
                  },
                ],
              },
              {
                type: "Card",
                children: [
                  {
                    type: "CardHeader",
                    children: [
                      { type: "CardDescription", children: "Memory Usage" },
                      { type: "CardTitle", props: { className: "text-2xl font-bold" }, children: "{{ state.memoryUsage }}%" },
                    ],
                  },
                  {
                    type: "CardContent",
                    children: [
                      {
                        type: "Progress",
                        props: { value: "{{ state.memoryUsage }}", "aria-label": "Memory Load" },
                      },
                    ],
                  },
                ],
              },
              {
                type: "Card",
                children: [
                  {
                    type: "CardHeader",
                    children: [
                      { type: "CardDescription", children: "Active Clients" },
                      { type: "CardTitle", props: { className: "text-2xl font-bold" }, children: "{{ state.activeConnections }}" },
                    ],
                  },
                  {
                    type: "CardContent",
                    children: [
                      {
                        type: "Badge",
                        props: { variant: "default" },
                        children: "Healthy Cluster",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "profile",
    name: "Profile & Settings",
    description: "User settings with avatar, inputs, and toggles",
    icon: "IconUser",
    schema: {
      title: "User Profile",
      state: {
        displayName: "Iuno",
        bio: "Explorer of the Sol-3 frontier",
        notifications: true,
      },
      actions: {
        saveSettings: "toast.success('Saved profile for ' + state.displayName)",
      },
      root: {
        type: "div",
        props: { className: "w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6" },
        children: [
          {
            type: "Card",
            children: [
              {
                type: "CardHeader",
                children: [
                  {
                    type: "div",
                    props: { className: "flex items-center gap-4" },
                    children: [
                      {
                        type: "Avatar",
                        props: { size: "lg" },
                        children: [
                          {
                            type: "AvatarFallback",
                            children: "IU",
                          },
                        ],
                      },
                      {
                        type: "div",
                        children: [
                          { type: "CardTitle", children: "{{ state.displayName }}" },
                          { type: "CardDescription", children: "Manage your public profile and preferences" },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "CardContent",
                props: { className: "space-y-4" },
                children: [
                  {
                    type: "Field",
                    children: [
                      { type: "FieldLabel", children: "Display Name" },
                      {
                        type: "Input",
                        props: {
                          bind: "state.displayName",
                          placeholder: "Enter display name...",
                        },
                      },
                    ],
                  },
                  {
                    type: "Field",
                    children: [
                      { type: "FieldLabel", children: "Biography" },
                      {
                        type: "Textarea",
                        props: {
                          bind: "state.bio",
                          placeholder: "Tell us about yourself...",
                        },
                      },
                    ],
                  },
                  {
                    type: "div",
                    props: { className: "flex items-center justify-between pt-2" },
                    children: [
                      {
                        type: "div",
                        children: [
                          { type: "span", props: { className: "text-sm font-medium" }, children: "Push Notifications" },
                          { type: "p", props: { className: "text-xs text-muted-foreground" }, children: "Receive real-time alerts" },
                        ],
                      },
                      {
                        type: "Switch",
                        props: { bindChecked: "state.notifications" },
                      },
                    ],
                  },
                ],
              },
              {
                type: "CardFooter",
                props: { className: "flex justify-end gap-2" },
                children: [
                  {
                    type: "Button",
                    props: {
                      variant: "default",
                      onPress: "actions.saveSettings()",
                    },
                    children: "Save Changes",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "tasks",
    name: "Task Manager",
    description: "Array repeater with dynamic add, delete, and toggle",
    icon: "IconListCheck",
    schema: {
      title: "Project Tasks",
      state: {
        newTitle: "",
        tasks: [
          { id: 1, title: "Review IrisPage SDUI architecture", done: true },
          { id: 2, title: "Design visual page builder", done: true },
          { id: 3, title: "Publish custom user page", done: false },
        ],
      },
      actions: {
        add: "if (!state.newTitle || !state.newTitle.trim()) { toast.error('Enter task title'); return; } push('tasks', { id: Date.now(), title: state.newTitle.trim(), done: false }); set('newTitle', ''); toast.success('Task added');",
      },
      root: {
        type: "div",
        props: { className: "w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6" },
        children: [
          {
            type: "Card",
            children: [
              {
                type: "CardHeader",
                children: [
                  { type: "CardTitle", children: "Task Tracker" },
                  { type: "CardDescription", children: "Manage your sprint backlog with live repeater loops" },
                ],
              },
              {
                type: "CardContent",
                props: { className: "space-y-4" },
                children: [
                  {
                    type: "div",
                    props: { className: "flex items-center gap-2" },
                    children: [
                      {
                        type: "Input",
                        props: {
                          bind: "state.newTitle",
                          placeholder: "Add new task...",
                          className: "flex-1",
                        },
                      },
                      {
                        type: "Button",
                        props: { variant: "default", onPress: "actions.add()" },
                        children: "Add",
                      },
                    ],
                  },
                  { type: "Separator" },
                  {
                    type: "div",
                    props: { className: "space-y-2" },
                    children: [
                      {
                        type: "div",
                        repeat: { items: "state.tasks", as: "item", indexAs: "idx" },
                        props: { className: "flex items-center justify-between p-3 rounded-2xl border bg-muted/20" },
                        children: [
                          {
                            type: "div",
                            props: { className: "flex items-center gap-3" },
                            children: [
                              {
                                type: "Button",
                                props: {
                                  size: "icon-xs",
                                  variant: "{{ item.done ? 'default' : 'outline' }}",
                                  onPress: "set('tasks.' + idx + '.done', !item.done)",
                                },
                                children: [
                                  { type: "Icon", props: { name: "{{ item.done ? 'IconCheck' : 'IconCircle' }}", className: "size-3" } },
                                ],
                              },
                              {
                                type: "span",
                                props: { className: "text-sm {{ item.done ? 'line-through text-muted-foreground' : '' }}" },
                                children: "{{ item.title }}",
                              },
                            ],
                          },
                          {
                            type: "Button",
                            props: {
                              size: "icon-xs",
                              variant: "ghost",
                              onPress: "remove('tasks', idx); toast.info('Removed task')",
                            },
                            children: [
                              { type: "Icon", props: { name: "IconTrash", className: "size-3.5 text-destructive" } },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from scratch with a clean full-width section",
    icon: "IconFile",
    schema: {
      title: "New Page",
      state: {},
      actions: {},
      root: {
        type: "div",
        props: { className: "w-full p-6 md:p-8 space-y-6" },
        children: [
          {
            type: "div",
            props: { className: "space-y-1 border-b border-border/40 pb-5" },
            children: [
              {
                type: "h1",
                props: { className: "font-heading text-2xl font-bold tracking-tight" },
                children: "Welcome to your new page",
              },
              {
                type: "p",
                props: { className: "text-sm text-muted-foreground" },
                children: "Use the Add Component button or section picker to start assembling your page.",
              },
            ],
          },
        ],
      },
    },
  },
]

import { ExtendedWebContents } from "common/extended-web-contents";
import { packets } from "common/packets";
import { queries } from "common/queries";
import { partitionForUser } from "common/util/partitions";
import { WebviewState } from "common/webview-state";
import { WebviewTag } from "electron";
import React, { useEffect, useRef, useState } from "react";
import { useProfile, useSocket } from "renderer/contexts";
import { WebviewNavigation } from "renderer/Shell/WebviewNavigation";
import { useListen } from "renderer/Socket";
import { useAsyncCb } from "renderer/use-async-cb";
import styled from "styled-components";
const WebviewActionBar = React.lazy(() =>
  import("renderer/Shell/WebviewActionBar")
);

const WebviewContainer = styled.div`
  width: 100%;
  height: 100%;

  background: ${p => p.theme.colors.shellBg};

  display: flex;
  flex-direction: column;
  justify-content: stretch;

  webview {
    width: 100%;
    flex-grow: 1;
  }
`;

export interface WebviewProps {
  url: string;
}

export const Webview = (props: WebviewProps) => {
  const socket = useSocket();
  const profile = useProfile();
  const viewRef = useRef<WebviewTag>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [url, setUrl] = useState(props.url);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState("");

  let [setWebviewHistory] = useAsyncCb(
    async (state: WebviewState) => {
      await socket.query(queries.setWebviewState, { state });
    },
    [socket]
  );

  useEffect(() => {
    const wv = viewRef.current;
    if (!wv) {
      return;
    }

    wv.addEventListener("will-navigate", ev => {
      setUrl(ev.url);
    });

    let didNavigate = (url: string) => {
      const wc = wv.getWebContents() as ExtendedWebContents;
      setWebviewHistory({
        history: wc.history,
        currentIndex: wc.currentIndex,
      });
      setUrl(url);
      setCanGoBack(wc.canGoBack());
      setCanGoForward(wc.canGoForward());
    };

    wv.addEventListener("did-navigate", ev => {
      if (/^about:blank/.test(ev.url)) {
        (async () => {
          try {
            let { state } = await socket.query(queries.getWebviewState);
            const { history, currentIndex } = state;
            const wc = wv.getWebContents() as ExtendedWebContents;
            wc.history = history;
            wc.goToIndex(currentIndex);
          } catch (e) {
            console.error(e);
            // alert(`Something went very wrong:\n\n${e.stack}`);
          }
        })();
      } else {
        didNavigate(ev.url);
      }
    });
    wv.addEventListener("did-navigate-in-page", ev => {
      didNavigate(ev.url);
    });

    wv.addEventListener("load-commit", ev => {
      if (ev.isMainFrame) {
        setUrl(ev.url);
      }
    });
    wv.addEventListener("page-title-updated", ev => {
      setTitle(ev.title);
    });
    wv.addEventListener("did-start-loading", ev => {
      setLoading(true);
    });
    wv.addEventListener("did-stop-loading", ev => {
      setLoading(false);

      const matches = /^itch:\/\/(.*)$/.exec(wv.getURL());
      if (matches) {
        setPath(matches[1]);
      } else {
        wv.executeJavaScript(
          `
          (document.querySelector("meta[name='itch:path']") || {content: ""}).content
        `
        ).then(path => {
          setPath(path);
        });
      }
    });
  }, [viewRef]);

  const [domReady, setDomReady] = useState(false);
  useEffect(() => {
    viewRef.current?.addEventListener("dom-ready", () => {
      setDomReady(true);
    });
  }, [setDomReady, viewRef.current]);

  useListen(
    socket,
    packets.navigate,
    ({ url: href }) => {
      if (!domReady) {
        console.warn(`Webview not ready yet, ignoring: ${href}`);
        return;
      }

      viewRef.current?.loadURL(href);
    },
    [domReady]
  );

  return (
    <WebviewContainer className="webview-container">
      <WebviewNavigation
        viewRef={viewRef}
        title={title}
        url={url}
        loading={loading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
      />
      <webview
        onFocus={onWebviewFocus}
        src={props.url}
        partition={partitionForUser(profile!.user.id)}
        ref={viewRef}
        webpreferences="nativeWindowOpen"
      />
      <WebviewActionBar path={path} />
    </WebviewContainer>
  );
};

function onWebviewFocus() {
  // When clicking on a webview, no "click" event is generated,
  // so we generate our own.
  //
  // See `useClickOutside`
  document.dispatchEvent(new Event("click-outside"));
}

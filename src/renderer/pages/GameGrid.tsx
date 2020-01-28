import { messages } from "common/butlerd";
import { Game, GameRecord } from "common/butlerd/messages";
import { packets } from "common/packets";
import { queries } from "common/queries";
import _ from "lodash";
import React, { useMemo, useState } from "react";
import { useClickOutside } from "renderer/basics/useClickOutside";
import { useSocket } from "renderer/contexts";
import { GameGridItem } from "renderer/pages/GameGridItem";
import { useListen } from "renderer/Socket";
import { animations, fontSizes, mixins } from "renderer/theme";
import { useAsyncCb } from "renderer/use-async-cb";
import { useDownloads } from "renderer/use-downloads";
import { useLaunches } from "renderer/use-launches";
import styled from "styled-components";

let coverBorder = 1;
const coverWidth = 300;
const coverHeight = 215;
let ratio = 0.9;

const GameGridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    ${coverWidth * ratio + coverBorder * 2}px
  );
  grid-row-gap: 2em;
  grid-column-gap: 1em;
  justify-content: space-evenly;

  padding: 40px 20px;

  & > .item {
    background: #202020;
    border: 1px solid #252525;
    border-radius: 4px;

    .cover-container {
      position: relative;
      width: ${coverWidth * ratio}px;
      height: ${coverHeight * ratio}px;

      & > .download-overlay {
        animation: ${animations.fadeIn} 0.2s ease-out;

        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;

        padding: 20px;

        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: flex-start;

        color: ${p => p.theme.colors.text2};
        font-size: ${fontSizes.small};

        & > .progress-bar {
          margin-bottom: 1em;
        }
      }

      & > .cover {
        width: 100%;
        height: 100%;

        &.missing {
          background-image: linear-gradient(12deg, #121212 0%, #191919 100%);
        }
      }
    }

    & > .title {
      padding: 4px 8px;
      padding-top: 14px;
      font-size: ${fontSizes.normal};
      ${mixins.singleLine};
    }

    .buttons {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 8px;

      .filler {
        flex-grow: 1;
      }
    }

    & > .title,
    & > .buttons {
      padding-left: 12px;
    }
  }
`;

const findGameId = (el: HTMLElement): number | undefined => {
  if (el.dataset.gameId) {
    return Number(el.dataset.gameId);
  }

  if (el.parentElement) {
    return findGameId(el.parentElement);
  }
  return undefined;
};

interface Props {
  records: GameRecord[];
  setRecords: React.Dispatch<React.SetStateAction<GameRecord[]>>;
}

export const GameGrid = React.forwardRef(function(props: Props, ref: any) {
  const socket = useSocket();

  const [gameBeingInstalled, setGameBeingInstalled] = useState<
    Game | undefined
  >();
  const stopInstall = useMemo(() => {
    return () => setGameBeingInstalled(undefined);
  }, [setGameBeingInstalled]);
  const coref = useClickOutside(() => {
    setGameBeingInstalled(undefined);
  });

  const [launch] = useAsyncCb(
    async function(ev: React.MouseEvent<HTMLButtonElement>) {
      const gameId = findGameId(ev.currentTarget);
      if (!gameId) {
        return;
      }
      await socket.query(queries.launchGame, { gameId });
    },
    [socket]
  );

  const [install] = useAsyncCb(
    async function(ev: React.MouseEvent<HTMLButtonElement>) {
      const gameId = findGameId(ev.currentTarget);
      if (!gameId) {
        console.warn(`no game id found for `, ev.currentTarget);
        return;
      }

      const { game } = await socket.call(messages.FetchGame, { gameId });
      setGameBeingInstalled(game);
    },
    [socket]
  );

  const [purchase] = useAsyncCb(
    async function(ev: React.MouseEvent<HTMLButtonElement>) {
      const gameId = findGameId(ev.currentTarget);
      if (!gameId) {
        console.warn(`no game id found for `, ev.currentTarget);
        return;
      }

      try {
        const { game } = await socket.callWithRefresh(messages.FetchGame, {
          gameId,
        });
        if (game) {
          location.href = `${game.url}/purchase`;
        }
      } catch (e) {
        console.warn(e);
      }
    },
    [socket]
  );

  const downloads = useDownloads();
  const launchesByGameId = _.keyBy(useLaunches(), l => l.gameId);

  useListen(
    socket,
    packets.gameInstalled,
    ({ cave }) => {
      updateRecord(props, {
        id: cave.game.id,
        installedAt: cave.stats.installedAt,
      });
    },
    []
  );
  useListen(
    socket,
    packets.gameUninstalled,
    ({ gameId }) => {
      (async () => {
        const { items } = await socket.call(messages.FetchCaves, {
          filters: { gameId },
        });

        if (_.isEmpty(items)) {
          updateRecord(props, {
            id: gameId,
            installedAt: undefined,
          });
        }
      })().catch(e => console.warn(e));
    },
    []
  );

  return (
    <>
      <GameGridContainer ref={ref}>
        {props.records.map(game => {
          const dl = _.find(downloads, d => d.game?.id == game.id);
          // N.B: we have to be extremely careful what we pass here.
          // GameGridItem is a memo'd component, so if we don't want to
          // re-render the whole grid, we need to not change props for all
          // items at once
          return (
            <GameGridItem
              key={game.id}
              game={game}
              dl={dl}
              coref={coref}
              install={install}
              launch={launch}
              purchase={purchase}
              stopInstall={stopInstall}
              gameBeingInstalled={
                gameBeingInstalled?.id == game.id
                  ? gameBeingInstalled
                  : undefined
              }
              beingLaunched={!!launchesByGameId[game.id]}
            />
          );
        })}
      </GameGridContainer>
    </>
  );
});

const updateRecord = (
  props: Props,
  fresh: Partial<GameRecord> & { id: number }
) => {
  props.setRecords(records => {
    let recIndex = _.findIndex(records, x => x.id === fresh.id);
    if (recIndex !== -1) {
      let newRecords = [...records];
      newRecords[recIndex] = { ...newRecords[recIndex], ...fresh };
      return newRecords;
    } else {
      return records;
    }
  });
};
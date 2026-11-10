import React, { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Platform,
  UIManager,
  LayoutAnimation,
} from "react-native";
import { Accelerometer } from "expo-sensors";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { styles, CONSTANTS } from "./styles";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { BOARD_SIZE, ACCEL_THRESHOLD, BOARD_WIDTH, CELL_GAP, CELL_SIZE } =
  CONSTANTS;

interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
}

let nextId = 1;

export default function HomeScreen() {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  const isTiltingRef = useRef(false);

  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const MAX_BALL_OFFSET = BOARD_WIDTH / 2 - 25;

  const initGame = () => {
    nextId = 1;
    let initialTiles: TileData[] = [
      {
        id: nextId++,
        value: Math.random() < 0.9 ? 2 : 4,
        row: Math.floor(Math.random() * 4),
        col: Math.floor(Math.random() * 4),
      },
      {
        id: nextId++,
        value: Math.random() < 0.9 ? 2 : 4,
        row: Math.floor(Math.random() * 4),
        col: Math.floor(Math.random() * 4),
      },
    ];
    if (
      initialTiles[0].row === initialTiles[1].row &&
      initialTiles[0].col === initialTiles[1].col
    ) {
      initialTiles[1].col = (initialTiles[1].col + 1) % 4;
    }
    setTiles(initialTiles);
    setScore(0);
    setGameOver(false);
    isTiltingRef.current = false;
  };

  useEffect(() => {
    initGame();
  }, []);

  const addNewTile = (currentTiles: TileData[]) => {
    const occupied = new Set(currentTiles.map((t) => `${t.row},${t.col}`));
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!occupied.has(`${r},${c}`)) {
          emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length === 0) return currentTiles;

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    return [
      ...currentTiles,
      { id: nextId++, value: Math.random() < 0.9 ? 2 : 4, row: r, col: c },
    ];
  };

  const move = (direction: "LEFT" | "RIGHT" | "UP" | "DOWN") => {
    if (gameOver) return;

    LayoutAnimation.configureNext({
      duration: 180,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.scaleXY,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    let grid: (TileData | null)[][] = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    tiles.forEach((t) => {
      grid[t.row][t.col] = t;
    });

    let moved = false;
    let scoreGained = 0;
    let newTilesMap: TileData[] = [];

    const processLine = (line: (TileData | null)[]) => {
      let items = line.filter((t): t is TileData => t !== null);
      let processed: { tile: TileData; mergedValue: number }[] = [];

      for (let i = 0; i < items.length; i++) {
        if (i < items.length - 1 && items[i].value === items[i + 1].value) {
          const newVal = items[i].value * 2;
          scoreGained += newVal;
          processed.push({ tile: items[i], mergedValue: newVal });
          i++;
        } else {
          processed.push({ tile: items[i], mergedValue: items[i].value });
        }
      }
      return processed;
    };

    if (direction === "LEFT" || direction === "RIGHT") {
      for (let r = 0; r < BOARD_SIZE; r++) {
        let rowLine = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          rowLine.push(grid[r][c]);
        }
        if (direction === "RIGHT") rowLine.reverse();

        const processed = processLine(rowLine);

        processed.forEach((item, targetIndex) => {
          const actualCol =
            direction === "RIGHT" ? BOARD_SIZE - 1 - targetIndex : targetIndex;
          if (
            item.tile.row !== r ||
            item.tile.col !== actualCol ||
            item.tile.value !== item.mergedValue
          ) {
            moved = true;
          }
          newTilesMap.push({
            ...item.tile,
            value: item.mergedValue,
            row: r,
            col: actualCol,
          });
        });
      }
    } else {
      for (let c = 0; c < BOARD_SIZE; c++) {
        let colLine = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          colLine.push(grid[r][c]);
        }
        if (direction === "DOWN") colLine.reverse();

        const processed = processLine(colLine);

        processed.forEach((item, targetIndex) => {
          const actualRow =
            direction === "DOWN" ? BOARD_SIZE - 1 - targetIndex : targetIndex;
          if (
            item.tile.row !== actualRow ||
            item.tile.col !== c ||
            item.tile.value !== item.mergedValue
          ) {
            moved = true;
          }
          newTilesMap.push({
            ...item.tile,
            value: item.mergedValue,
            row: actualRow,
            col: c,
          });
        });
      }
    }

    if (moved) {
      const updated = addNewTile(newTilesMap);
      setTiles(updated);
      setScore((prev) => prev + scoreGained);
    }
  };

  useEffect(() => {
    Accelerometer.setUpdateInterval(40);

    const subscription = Accelerometer.addListener(({ x, y }) => {
      const targetX = Math.max(
        -MAX_BALL_OFFSET,
        Math.min(MAX_BALL_OFFSET, x * 150),
      );
      const targetY = Math.max(
        -MAX_BALL_OFFSET,
        Math.min(MAX_BALL_OFFSET, -y * 150),
      );

      ballX.value = withSpring(targetX, { damping: 15, stiffness: 120 });
      ballY.value = withSpring(targetY, { damping: 15, stiffness: 120 });

      const absX = Math.abs(x);
      const absY = Math.abs(y);

      if (
        !isTiltingRef.current &&
        (absX > ACCEL_THRESHOLD || absY > ACCEL_THRESHOLD)
      ) {
        if (absX > absY) {
          if (x > ACCEL_THRESHOLD) move("RIGHT");
          else if (x < -ACCEL_THRESHOLD) move("LEFT");
        } else {
          if (y > ACCEL_THRESHOLD) move("UP");
          else if (y < -ACCEL_THRESHOLD) move("DOWN");
        }
        isTiltingRef.current = true;
      } else if (isTiltingRef.current && absX < 0.2 && absY < 0.2) {
        isTiltingRef.current = false;
      }
    });

    return () => subscription.remove();
  }, [tiles, gameOver]);

  const animatedBallStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: ballX.value }, { translateY: ballY.value }],
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>2048 Physics</Text>
        <TouchableOpacity
          style={styles.debugToggleButton}
          onPress={() => setIsDebugMode(!isDebugMode)}
        >
          <Text style={styles.debugToggleText}>
            {isDebugMode ? "本番モード" : "🔧 デバッグ"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.score}>SCORE: {score}</Text>

      <View style={styles.board}>
        <Animated.View style={[styles.physicsBall, animatedBallStyle]} />

        {Array(BOARD_SIZE)
          .fill(0)
          .map((_, r) => (
            <View key={r} style={styles.row}>
              {Array(BOARD_SIZE)
                .fill(0)
                .map((_, c) => (
                  <View key={c} style={styles.cellBackground} />
                ))}
            </View>
          ))}

        <View style={styles.tileLayer}>
          {tiles.map((tile) => {
            const left = CELL_GAP + tile.col * (CELL_SIZE + CELL_GAP);
            const top = CELL_GAP + tile.row * (CELL_SIZE + CELL_GAP);
            return (
              <View
                key={tile.id}
                style={[
                  styles.tile,
                  { left, top },
                  styles[`tile${tile.value}` as keyof typeof styles] || {},
                ]}
              >
                <Text
                  style={[
                    styles.tileText,
                    tile.value > 4 && { color: "#f9f6f2" },
                  ]}
                >
                  {tile.value}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {!isDebugMode ? (
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            📱 スマホを傾けてボールを転がそう
          </Text>
        </View>
      ) : (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => move("UP")}
          >
            <Text style={styles.btnText}>⬆️ 奥へ</Text>
          </TouchableOpacity>
          <View style={styles.horizontalControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => move("LEFT")}
            >
              <Text style={styles.btnText}>⬅️ 左へ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => move("RIGHT")}
            >
              <Text style={styles.btnText}>➡️ 右へ</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => move("DOWN")}
          >
            <Text style={styles.btnText}>⬇️ 手前へ</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.resetButton} onPress={initGame}>
        <Text style={styles.resetButtonText}>リセット</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

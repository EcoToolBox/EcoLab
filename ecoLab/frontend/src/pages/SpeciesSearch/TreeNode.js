import { useState, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Chip,
  Collapse,
  Tooltip,
} from "@mui/material"
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useTreeNode } from "../../hooks/useTreeNode";
import { RANK_LABELS, RANK_COLORS } from "../../constants/taxonomy";

export default function TreeNode({ node, selectedSpecies, onSelect, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const { children, loading, loaded, error, load } = useTreeNode(node.key);
  const [loadingAll, setLoadingAll] = useState(false);
  const isSpecies = node.rank === "SPECIES";
  const isGenus = node.rank === "GENUS";
  const isSelected = selectedSpecies.some((s) => s.key === node.key);
  const hasChildren = node.hasChildren && !isSpecies;
  const rankColor = RANK_COLORS[node.rank] ?? "#333";

  const handleToggle = useCallback(async () => {
    if (!hasChildren) return;
    if (!expanded) await load();
    setExpanded((prev) => !prev);
  }, [expanded, hasChildren, load]);

  const handleSelectAll = useCallback(async (e) => {
  e.stopPropagation();
  setLoadingAll(true);
  try {
    if (!loaded) await load();
    setExpanded(true);
    if (!expanded) await load();
    children.forEach((sp) => onSelect(sp));
  } finally {
    setLoadingAll(false);
  }
}, [loaded, load, children, onSelect]);

  const handleSelect = useCallback(
    (e) => {
      e.stopPropagation();
      if (isSelected) onSelect(node, { remove: true });
      if (isSpecies) onSelect(node);
    },
    [isSpecies, node, onSelect]
  );

  return (
    <Box>
      <Box
        onClick={isSpecies ? handleSelect : handleToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: `${depth * 20 + 8}px`,
          pr: 1,
          py: 0.75,
          cursor: hasChildren || isSpecies ? "pointer" : "default",
          borderRadius: 1,
          transition: "background 0.15s",
          "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
          "&:hover .action-btn": { opacity: 1 },
        }}
        role={isSpecies ? "button" : "treeitem"}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            isSpecies ? handleSelect(e) : handleToggle();
          }
        }}
      >
        {/* Expand / collapse icon */}
        <Box sx={{ width: 24, flexShrink: 0 }}>
          {hasChildren && (
            <IconButton size="small" tabIndex={-1} sx={{ p: 0, color: "inherit" }}>
              {loading ? (
                <CircularProgress size={14} sx={{ color: "#D95204" }} />
              ) : expanded ? (
                <ExpandMoreIcon fontSize="small" sx={{ color: "#D95204" }}  />
              ) : (
                <ChevronRightIcon fontSize="small"sx={{ color: "#D95204" }}  />
              )}
            </IconButton>
          )}
        </Box>

        {/* Rank badge */}
        <Chip
          label={RANK_LABELS[node.rank] ?? node.rank}
          size="small"
          sx={{
            bgcolor: rankColor,
            color: "#fff",
            fontSize: "0.6rem",
            height: 18,
            flexShrink: 0,
          }}
        />

        {/* Name */}
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontStyle: isSpecies ? "italic" : "normal",
            color: isSelected ? "#D95204" : "inherit",
            fontWeight: isSpecies ? 500 : 400,
          }}
        >
          {node.canonicalName ?? node.name}
        </Typography>

        {/* Select all species from genus */}
        {isGenus && (
          <Tooltip title="Selecionar todas as espécies do gênero">
            <span>
              <IconButton
                size="small"
                onClick={handleSelectAll}
                tabIndex={-1}
                aria-label="Selecionar todas as espécies do gênero"
                className="action-btn"
                sx={{
                  opacity: 0,
                  transition: "opacity 0.15s",
                  color: "rgba(255,255,255,0.4)",
                  p: 0.25,
                  "&:hover": { color: "#D95204" },
                }}
              >
                {loadingAll ? (
                  <CircularProgress size={14} sx={{ color: "#D95204" }} />
                ) : (
                  <PlaylistAddIcon fontSize="small" sx={{ color: "#D95204" }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Select button for species */}
        {isSpecies && (
          <IconButton
            size="small"
            onClick={handleSelect}
            tabIndex={-1}
            aria-label={isSelected ? "Espécie selecionada" : "Selecionar espécie"}
            sx={{ color: isSelected ? "#D95204" : "rgba(255,255,255,0.4)", p: 0.25 }}
          >
            {isSelected ? (
              <CheckCircleIcon fontSize="small" />
            ) : (
              <AddCircleOutlineIcon fontSize="small" sx={{ color: "#D95204" }} />
            )}
          </IconButton>
        )}
      </Box>

      {/* Error state */}
      {error && (
        <Box sx={{ pl: `${depth * 20 + 32}px`, py: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
          <ErrorOutlineIcon fontSize="small" sx={{ color: "#f44336" }} />
          <Typography variant="caption" color="error">{error}</Typography>
        </Box>
      )}

      {/* Children */}
      {hasChildren && loaded && (
        <Collapse in={expanded} timeout="auto">
          {children.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              selectedSpecies={selectedSpecies}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

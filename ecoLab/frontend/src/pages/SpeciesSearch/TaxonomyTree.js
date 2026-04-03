import { useEffect } from "react";
import { Box, Typography, CircularProgress, Button } from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { useTreeNode } from "../../hooks/useTreeNode";
import TreeNode from "./TreeNode";

export default function TaxonomyTree({ selectedSpecies, onSelect }) {
  const { children, loading, loaded, error, load } = useTreeNode("root");

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <AccountTreeIcon sx={{ color: "#D95204", fontSize: 18 }} />
        <Typography variant="subtitle2" sx={{ color: "rgba(255,255,255,0.7)", letterSpacing: 1, textTransform: "uppercase", fontSize: "0.7rem" }}>
          Navegar por taxonomia
        </Typography>
      </Box>

      <Box
        sx={{
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.08)",
          maxHeight: 420,
          overflowY: "auto",
          color:"#0f1a00",
          py: 0.5,
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: "rgba(217,82,4,0.4)", borderRadius: 3 },
        }}
        role="tree"
        aria-label="Árvore taxonômica"
      >
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} sx={{ color: "#D95204" }} />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="error" mb={1}>{error}</Typography>
            <Button size="small" onClick={load} sx={{ color: "#D95204" }}>
              Tentar novamente
            </Button>
          </Box>
        )}

        {loaded &&
          children.map((node) => (
            <TreeNode
              key={node.key}
              node={node}
              selectedSpecies={selectedSpecies}
              onSelect={onSelect}
              depth={0}
            />
          ))}
      </Box>
    </Box>
  );
}

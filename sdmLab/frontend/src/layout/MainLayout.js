import { Box, Typography, List, ListItem, ListItemText, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { Outlet } from "react-router-dom";

export default function MainLayout({ selectedSpecies = [], setSelectedSpecies }) {
  return (
    <Box sx={{ display: "flex", height: "100vh",  color: "white" }}>

      <Box sx={{ width: "30%", p: 3, borderRight: "1px solid #222", border: "1px 0 3px ", bgcolor: "#172601",}}>
        <Typography variant="h6" mb={2}>
          Espécies selecionadas
        </Typography>

        <List sx={{ maxHeight: "80vh", overflow: "auto" }}>
          {selectedSpecies.map((item) => (
            <ListItem
              key={item.key}
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={() =>
                    setSelectedSpecies((prev) =>
                      prev.filter((s) => s.key !== item.key)
                    )
                  }
                >
                  <DeleteIcon sx={{ color: "white" }} />
                </IconButton>
              }
            >
              <ListItemText primary={item.name} />
            </ListItem>
          ))}
        </List>
      </Box>

      <Box sx={{ width: "70%", p: 4 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
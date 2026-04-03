import { Box, Typography, OutlinedInput, InputLabel, FormControl, IconButton, Popover} from "@mui/material";
import {Visibility, VisibilityOff } from '@mui/icons-material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useState} from "react";
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import CustomWarning from "../../components/CustomWarning";


export default function PopupsMsg({msg}) {
    const [anchorEl, setAnchorEl] = useState(null);

    const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
    setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
  return (
    <Box>
        <IconButton size="medium" onClick={handleClick}>
            <HelpOutlineIcon fontSize="medium" />
        </IconButton>
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
            }}
            >
            <Typography
            sx={{ p: 2 }}
            dangerouslySetInnerHTML={{ __html: msg }}
            />
        </Popover>
    </Box>
  )};
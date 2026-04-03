import { Box, Typography, OutlinedInput, InputLabel, FormControl, IconButton, Popover} from "@mui/material";
import {Visibility, VisibilityOff } from '@mui/icons-material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useState} from "react";
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import CustomWarning from "../../components/CustomWarning";
import PopupsMsg from "./PopUp";


export default function SourcesCheckBox({selectedSources, setSelectedSources, sourceConfig, setSourceConfig}) {
    const [showPassword, setShowPassword] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);

    const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
    setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    const handleConfigChange = (source, field) => (event) => {
    const value = event.target.value;

    setSourceConfig((prev) => ({
        ...prev,
        [source]: {
        ...prev[source],
        [field]: value,
        },
    }));
    };

    const handleClickShowPassword = () => setShowPassword((show) => !show);

    const handleMousePassword = (event) => {
        event.preventDefault();
    };
    const handleChangeSources = (event) => {
    const { name, checked } = event.target;

    setSelectedSources((prev) => {
        if (checked) {
        return [...prev, name];
        }
        return prev.filter((item) => item !== name);
    });
    };
  return (
    <Box>
      <FormGroup label="Fontes de Dados" style={{ color: "#333" }}>
         <Typography gutterBottom style={{fontWeight: 600}}>
                Selecione as fontes de dados
            </Typography>
        <FormControlLabel
          control={
            <Checkbox
              name="gbif"
              checked={selectedSources.includes("gbif")}
              onChange={handleChangeSources}
            />
          }
          label="GBIF"
        />
        {(selectedSources.includes("gbif")) && (
        <Box>
        <FormControl sx={{ m: 1, width: '45ch' }} variant="outlined">
          <InputLabel>Email</InputLabel>
           <OutlinedInput
            required
            value={sourceConfig.gbif.email}
            onChange={handleConfigChange("gbif", "email")}
            />
          
        </FormControl>
        <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
          <InputLabel>User ID</InputLabel>
            <OutlinedInput
            required
            value={sourceConfig.gbif.userId}
            onChange={handleConfigChange("gbif", "userId")}
            />
          
        </FormControl>
        
        <FormControl sx={{ m: 1, width: '50ch', flexDirection: "row"}} variant="outlined">
          <InputLabel>Password</InputLabel>
          <OutlinedInput
            required
            type={showPassword ? "text" : "password"}
            value={sourceConfig.gbif.apiKey}
            onChange={handleConfigChange("gbif", "apiKey")}
            endAdornment={
                <IconButton
                  aria-label={
                    showPassword ? 'hide the password' : 'display the password'
                  }
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMousePassword}
                  onMouseUp={handleMousePassword}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
            }
            label="Password"
          />
          <PopupsMsg msg={` Use as mesmas credenciais da sua conta GBIF`} />
        </FormControl>
        </Box>
        )}
        <FormControlLabel
          control={
            <Checkbox
              name="inaturalist"
              checked={selectedSources.includes("inaturalist")}
              onChange={handleChangeSources}
            />
          }
          label="INaturalist"
        />

        <FormControlLabel
          control={
            <Checkbox
              name="specieslink"
              checked={selectedSources.includes("specieslink")}
              onChange={handleChangeSources}
            />
          }
          label="SpeciesLink"
        />
        {(selectedSources.includes("specieslink")) && (
        <FormControl sx={{ m: 1, width: '50ch', flexDirection: "row"}} variant="outlined">
          <InputLabel htmlFor="outlined-adornment-password">API key </InputLabel>
          <OutlinedInput
            value={sourceConfig.specieslink.apiKey}
            onChange={handleConfigChange("specieslink", "apiKey")}
            type={showPassword ? 'text' : 'password'}
            endAdornment={
                <IconButton
                  aria-label={
                    showPassword ? 'hide the password' : 'display the password'
                  }
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMousePassword}
                  onMouseUp={handleMousePassword}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
            }
            label="Password"
          />

          <PopupsMsg msg={"Para adquirir a API key do SpeciesLink, acesse <a target='_blank' href='https://specieslink.net/aut/login/?next=/aut/profile/apikeys'> species link site</a>"} />
        </FormControl>
        )}
      </FormGroup>
      </Box>
  );
}
